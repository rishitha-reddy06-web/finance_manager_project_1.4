"""
AI Prediction Service for Personal Finance Manager
Uses time-series forecasting (ARIMA/Linear Regression) to predict future expenses
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

app = FastAPI(title="Finance AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictionRequest(BaseModel):
    monthly_expenses: Dict[str, float]
    forecast_months: int = 3


class CategoryPredictionRequest(BaseModel):
    category_data: Dict[str, Dict[str, float]]  # {category: {month: amount}}
    forecast_months: int = 3


class PredictionResult(BaseModel):
    month: str
    predicted: float
    lower_bound: float
    upper_bound: float


def get_next_months(n: int) -> List[str]:
    """Get next n month labels"""
    months = []
    now = datetime.now()
    for i in range(n):
        future = datetime(now.year, now.month, 1)
        month_offset = now.month + i + 1
        year_offset = now.year + (month_offset - 1) // 12
        month_num = ((month_offset - 1) % 12) + 1
        dt = datetime(year_offset, month_num, 1)
        months.append(dt.strftime("%b %Y"))
    return months


def linear_regression_predict(values: List[float], n_ahead: int) -> List[float]:
    """Simple linear regression prediction"""
    if len(values) < 2:
        avg = values[0] if values else 0
        return [avg] * n_ahead
    
    x = np.arange(len(values)).reshape(-1, 1)
    y = np.array(values)
    
    # Linear regression manually
    x_mean = np.mean(x)
    y_mean = np.mean(y)
    slope = np.sum((x.flatten() - x_mean) * (y - y_mean)) / np.sum((x.flatten() - x_mean) ** 2)
    intercept = y_mean - slope * x_mean
    
    predictions = []
    for i in range(len(values), len(values) + n_ahead):
        pred = slope * i + intercept
        predictions.append(max(0, round(pred, 2)))
    
    return predictions


def weighted_moving_average(values: List[float], n_ahead: int, window: int = 3) -> List[float]:
    """Weighted moving average with trend detection"""
    if not values:
        return [0] * n_ahead
    
    predictions = []
    current_values = list(values)
    
    for _ in range(n_ahead):
        recent = current_values[-min(window, len(current_values)):]
        weights = np.arange(1, len(recent) + 1)
        wma = np.average(recent, weights=weights)
        
        # Add trend component
        if len(current_values) >= 2:
            trend = (current_values[-1] - current_values[0]) / len(current_values)
            wma += trend * 0.3
        
        pred = max(0, round(wma, 2))
        predictions.append(pred)
        current_values.append(pred)
    
    return predictions


def arima_like_predict(values: List[float], n_ahead: int) -> tuple:
    """ARIMA-like prediction using statsmodels if available"""
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        
        if len(values) < 4:
            preds = weighted_moving_average(values, n_ahead)
            std = np.std(values) if len(values) > 1 else 0
            return preds, std
        
        series = pd.Series(values)
        model = ExponentialSmoothing(series, trend='add', seasonal=None).fit(optimized=True)
        forecast = model.forecast(n_ahead)
        
        residuals = series.values - model.fittedvalues
        std = np.std(residuals)
        
        return [max(0, round(f, 2)) for f in forecast], std
    
    except Exception:
        preds = weighted_moving_average(values, n_ahead)
        std = np.std(values) if len(values) > 1 else 0
        return preds, std


@app.get("/health")
def health():
    return {"status": "ok", "service": "Finance AI Prediction Service"}


@app.post("/predict")
def predict_expenses(request: PredictionRequest):
    """
    Predict future monthly expenses using time-series forecasting
    """
    try:
        # Sort and extract values
        sorted_data = dict(sorted(request.monthly_expenses.items()))
        
        if len(sorted_data) < 2:
            return {
                "predictions": [
                    {"month": m, "predicted": list(sorted_data.values())[0] if sorted_data else 0,
                     "lower_bound": 0, "upper_bound": 0}
                    for m in get_next_months(request.forecast_months)
                ],
                "method": "constant",
                "confidence": "low",
                "message": "Insufficient data for accurate prediction"
            }
        
        values = list(sorted_data.values())
        
        # Use Holt-Winters exponential smoothing when enough data
        predictions, std = arima_like_predict(values, request.forecast_months)
        
        next_months = get_next_months(request.forecast_months)
    
        results = []
        for i, (month, pred) in enumerate(zip(next_months, predictions)):
            margin = std * 1.96 * (1 + i * 0.1)  # Increase uncertainty over time
            results.append({
                "month": month,
                "predicted": pred,
                "lower_bound": max(0, round(pred - margin, 2)),
                "upper_bound": round(pred + margin, 2),
            })
                    
        # Calculate trend
        if len(values) >= 2:
            trend_pct = ((values[-1] - values[0]) / max(values[0], 1)) * 100 / len(values)
            trend = "increasing" if trend_pct > 2 else "decreasing" if trend_pct < -2 else "stable"
        else:
            trend = "stable"
        
        return {
            "predictions": results,
            "method": "exponential_smoothing",
            "confidence": "high" if len(values) >= 6 else "medium",
            "trend": trend,
            "message": f"Forecast based on {len(values)} months of data"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/categories")
def predict_by_category(request: CategoryPredictionRequest):
    """
    Predict expenses by category
    """
    try:
        results = {}
        
        for category, monthly_data in request.category_data.items():
            sorted_data = dict(sorted(monthly_data.items()))
            values = list(sorted_data.values())
            
            if not values:
                continue
            
            predictions, std = arima_like_predict(values, request.forecast_months)
            next_months = get_next_months(request.forecast_months)
            
            results[category] = [
                {
                    "month": m,
                    "predicted": p,
                    "lower_bound": max(0, round(p - std * 1.96, 2)),
                    "upper_bound": round(p + std * 1.96, 2),
                }
                for m, p in zip(next_months, predictions)
            ]
        
        return {"category_predictions": results}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/anomaly")
def detect_anomalies(data: Dict[str, float]):
    """
    Detect unusual transactions using Z-score method
    """
    if len(data) < 3:
        return {"anomalies": [], "message": "Insufficient data"}
    
    values = np.array(list(data.values()))
    mean = np.mean(values)
    std = np.std(values)
    
    anomalies = []
    for key, val in data.items():
        z_score = abs((val - mean) / std) if std > 0 else 0
        if z_score > 2.5:
            anomalies.append({
                "key": key,
                "value": val,
                "z_score": round(z_score, 2),
                "deviation": round(val - mean, 2),
            })
    
    return {"anomalies": anomalies, "mean": round(mean, 2), "std": round(std, 2)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
