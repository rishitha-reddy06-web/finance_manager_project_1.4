import React, { useState, useEffect } from 'react';
import { MONTH_NAMES } from '../pages/Budgets'; // Assuming we export it or define it here

const CustomDatePicker = ({ selectedDate, onChange, onClose }) => {
  const [view, setView] = useState('calendar'); // calendar, month, year
  const [currentDate, setCurrentDate] = useState(new Date(selectedDate || new Date()));
  const [selected, setSelected] = useState(new Date(selectedDate || new Date()));

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [];
  for (let i = 1900; i <= 2100; i++) years.push(i);

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelected(newDate);
    onChange(newDate);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate.getMonth(), currentDate.getFullYear());
    const firstDay = getFirstDayOfMonth(currentDate.getMonth(), currentDate.getFullYear());
    const days = [];

    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const isSelected = selected.getDate() === i && 
                        selected.getMonth() === currentDate.getMonth() && 
                        selected.getFullYear() === currentDate.getFullYear();
      const isToday = new Date().getDate() === i && 
                      new Date().getMonth() === currentDate.getMonth() && 
                      new Date().getFullYear() === currentDate.getFullYear();

      days.push(
        <div 
          key={i} 
          className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
          onClick={() => handleDateClick(i)}
        >
          {i}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="custom-datepicker">
      <div className="datepicker-header">
        <button className="nav-btn" onClick={handlePrevMonth}>&lt;</button>
        <div className="current-view">
          <span onClick={() => setView('month')}>{months[currentDate.getMonth()]}</span>
          <span onClick={() => setView('year')}>{currentDate.getFullYear()}</span>
        </div>
        <button className="nav-btn" onClick={handleNextMonth}>&gt;</button>
      </div>

      {view === 'calendar' && (
        <>
          <div className="calendar-weekdays">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="calendar-grid">
            {renderCalendar()}
          </div>
        </>
      )}

      {view === 'month' && (
        <div className="month-selector">
          {months.map((m, i) => (
            <div 
              key={m} 
              className={`selector-item ${currentDate.getMonth() === i ? 'active' : ''}`}
              onClick={() => {
                setCurrentDate(new Date(currentDate.getFullYear(), i, 1));
                setView('calendar');
              }}
            >
              {m.substring(0, 3)}
            </div>
          ))}
        </div>
      )}

      {view === 'year' && (
        <div className="year-selector">
          {years.map(y => (
            <div 
              key={y} 
              id={`year-${y}`}
              className={`selector-item ${currentDate.getFullYear() === y ? 'active' : ''}`}
              onClick={() => {
                setCurrentDate(new Date(y, currentDate.getMonth(), 1));
                setView('calendar');
              }}
            >
              {y}
            </div>
          ))}
        </div>
      )}

      <div className="datepicker-footer">
        <button className="today-btn" onClick={() => {
          const today = new Date();
          setCurrentDate(today);
          setSelected(today);
          onChange(today);
        }}>Today</button>
        <button className="close-btn" onClick={onClose}>Done</button>
      </div>

      <style>{`
        .custom-datepicker {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 15px;
          width: 280px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          color: white;
          user-select: none;
        }
        .datepicker-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .current-view {
          font-weight: 700;
          cursor: pointer;
          display: flex;
          gap: 8px;
        }
        .current-view span:hover { color: #6366f1; }
        .nav-btn {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 18px;
          padding: 5px 10px;
        }
        .nav-btn:hover { color: white; }
        .calendar-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          font-size: 11px;
          color: #64748b;
          margin-bottom: 8px;
        }
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .calendar-day {
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .calendar-day:hover:not(.empty) { background: #334155; }
        .calendar-day.selected { background: #6366f1; color: white; }
        .calendar-day.today { border: 1px solid #6366f1; color: #6366f1; }
        .month-selector, .year-selector {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          height: 200px;
          overflow-y: auto;
          padding-right: 5px;
        }
        .year-selector { grid-template-columns: repeat(4, 1fr); }
        .selector-item {
          padding: 8px;
          text-align: center;
          font-size: 13px;
          cursor: pointer;
          border-radius: 6px;
        }
        .selector-item:hover { background: #334155; }
        .selector-item.active { background: #6366f1; color: white; }
        .datepicker-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 15px;
          padding-top: 10px;
          border-top: 1px solid #334155;
        }
        .today-btn, .close-btn {
          background: none;
          border: none;
          color: #6366f1;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .close-btn { color: #94a3b8; }
        /* Scrollbar styling */
        .month-selector::-webkit-scrollbar, .year-selector::-webkit-scrollbar { width: 4px; }
        .month-selector::-webkit-scrollbar-thumb, .year-selector::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default CustomDatePicker;
