# Receipt Scanning - Quick Reference & Cheat Sheet

## 📝 Installation (Copy-Paste)

```bash
cd backend

# Core (required)
npm install sharp

# Optional OCR alternatives
npm install @google-cloud/vision      # For better accuracy
npm install aws-sdk                   # For AWS Textract
npm install @azure/cognitiveservices-computervision @azure/ms-rest-js  # For Azure
```

## 🚀 Quickest Integration (5 minutes)

### 1. Add to server.js
```javascript
const enhancedReceiptService = require('./services/enhancedReceiptService');

app.post('/api/receipts/scan', multer().single('receipt'), async (req, res) => {
  const result = await enhancedReceiptService.processReceiptImage(req.file.path);
  res.json(result.extracted);
});
```

### 2. Frontend (React)
```javascript
const handleReceiptUpload = async (file) => {
  const formData = new FormData();
  formData.append('receipt', file);
  
  const response = await fetch('/api/receipts/scan', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  console.log(result.items); // Array of { item, amount, category }
};
```

## 📊 Output Format

```json
{
  "store": "ABC General Store",
  "date": "2024-04-16",
  "items": [
    {
      "item": "Rice (5 kg)",
      "amount": 300,
      "quantity": 5,
      "unit": "kg",
      "category": "Food & Dining",
      "confidence": 0.85
    }
  ],
  "total": 619.50,
  "tax": 29.50,
  "confidence": 0.89
}
```

## ⚙️ Configuration

### Environment Variables (.env)
```env
OCR_PROVIDER=tesseract                 # or: google-vision, aws-textract, azure-vision
ENABLE_PREPROCESSING=true
USE_INDIAN_PARSER=true
NODE_ENV=production
```

### Quick Setup for Google Vision
```bash
# 1. Get API key from: https://console.cloud.google.com
# 2. Save JSON key as: credentials.json
# 3. Set environment variable:
export GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/credentials.json
```

## 🎯 Common Usage Patterns

### Pattern 1: Basic Scan
```javascript
const result = await enhancedService.processReceiptImage(imagePath);
// Returns: Full parsed receipt with items, store, total, etc.
```

### Pattern 2: Fast Processing (No Preprocessing)
```javascript
const result = await enhancedService.processReceiptImage(imagePath, {
  preprocess: false  // Faster but lower accuracy
});
```

### Pattern 3: Best Accuracy (Google Vision)
```javascript
const result = await enhancedService.processReceiptImage(imagePath, {
  ocrProvider: 'google-vision',
  preprocess: true
});
```

### Pattern 4: Batch Processing
```javascript
const results = await enhancedService.batchProcessReceipts(filePaths, {
  concurrency: 2  // Process 2 at a time
});
```

### Pattern 5: Debug Mode
```javascript
const result = await enhancedService.processReceiptImage(imagePath, {
  saveDebugImages: true,      // Save preprocessed images
  debugOutputDir: './debug'   // Where to save
});
```

## 🔍 Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| Low accuracy (<70%) | Use Google Vision: `ocrProvider: 'google-vision'` |
| Slow processing | Disable preprocessing: `preprocess: false` OR use Google Vision |
| Wrong amounts | Happens with low res - enable preprocessing |
| Missing items | Check OCR text first: `result.steps.ocr` |
| Indian rupee issues | Enable: `useIndianParser: true` |
| Google Vision fails | Check: `GOOGLE_APPLICATION_CREDENTIALS` env var |

## 📈 Accuracy vs Speed vs Cost

```
Tesseract:     70% accuracy | 5-10s | Free
Google Vision: 90% accuracy | 1-2s  | $15 for 10K images
```

**Recommendation for different scenarios:**
- **MVP/Prototype**: Tesseract (free, 5-min setup)
- **Production**: Google Vision (high accuracy, low cost)
- **Enterprise**: AWS Textract (best accuracy, structure understanding)

## ✅ Validation Examples

### Check if parsing succeeded
```javascript
if (result.status === 'completed' && result.extracted.confidence > 0.7) {
  // Good quality extraction, safe to use
  saveToDatabase(result.extracted);
} else if (result.status === 'completed' && result.extracted.confidence < 0.4) {
  // Low confidence, ask user to verify
  showManualEntryForm();
}
```

### Only accept high-confidence items
```javascript
const reliableItems = result.extracted.items.filter(item => 
  item.amount > 0 && item.amount < 100000 && item.category !== 'Other'
);
```

### Validate receipt total
```javascript
const itemSum = result.extracted.items.reduce((s, i) => s + i.amount, 0);
const expectedTotal = itemSum + (result.extracted.tax || 0);
const tolerance = expectedTotal * 0.05; // 5% tolerance

if (Math.abs(result.extracted.total - expectedTotal) > tolerance) {
  console.warn('Receipt total mismatch - OCR may have errors');
}
```

## 🐛 Debug Techniques

### View OCR text before parsing
```javascript
const Tesseract = require('tesseract.js');
const buffer = fs.readFileSync(imagePath);
const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
console.log(text); // Raw OCR output
```

### Check classification of each line
```javascript
const improvedParser = require('./services/improvedReceiptParser');
const lines = ocrText.split('\n');

lines.forEach(line => {
  const classification = improvedParser.classifyReceiptLine(line);
  console.log(`"${line}" → ${classification.itemType}`);
});
```

### Compare OCR providers
```javascript
const comparison = await enhancedService.getProviderComparison(imagePath);
console.log(comparison); // See which provider works best
```

## 📦 Files Organization

```
backend/
├── services/
│   ├── enhancedReceiptService.js      ← Main orchestrator
│   ├── receiptPreprocessor.js         ← Image preprocessing
│   ├── improvedReceiptParser.js       ← Smart parsing
│   ├── indianReceiptParser.js         ← Indian-specific
│   └── ocrAlternatives.js             ← Google/AWS/Azure
├── routes/
│   └── receipts-enhanced.js           ← API endpoints
└── package.json                        ← Add 'sharp' dependency
```

## 🌍 For Other Languages

To support other languages, modify Tesseract configuration:

```javascript
// English only (current)
const { data: { text } } = await Tesseract.recognize(buffer, 'eng');

// English + Hindi (for Indian receipts)
const { data: { text } } = await Tesseract.recognize(buffer, 'eng+hin');

// English + Multiple
const { data: { text } } = await Tesseract.recognize(buffer, 'eng+fra+spa');
```

## 💡 Best Practices

✅ **DO:**
- Always use preprocessing for low-quality images
- Handle errors gracefully with fallbacks
- Show confidence score to users
- Use batch processing for multiple receipts
- Cache OCR results if processing multiple times
- Validate extracted amounts (> 0 and < 999999)

❌ **DON'T:**
- Process images without checking file size
- Ignore warnings from the parser
- Use Tesseract for production critical work (use Google Vision)
- Process large batches sequentially (use concurrency)
- Trust OCR with confidence < 0.5 without review


Software Engineering Lab – Practical Command Reference
A quick revision guide for Windows (Git Bash, CMD or PowerShell), Eclipse, Java 21, Maven, Jenkins, Docker Desktop, Minikube and Nagios. Examples are for local lab practice; replace placeholders and verify free ports. Commands are not an exhaustive reference for every tool.

Contents
Git and GitHub
Maven
Tomcat
Docker CLI and Docker Hub
Dockerfile
Docker Compose
Jenkins
Kubernetes and Minikube
Nagios
AWS CLI
Quick troubleshooting
1. Git and GitHub
Run in Git Bash inside the project folder. Replace YOUR_GITHUB_URL and other placeholders with actual values.

git --version
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
git config --list
git init
git status
git add .
git add README.md
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_GITHUB_URL
git push -u origin main
For a new empty remote repository, the above publishes your local project. Before git add ., create a .gitignore and check that secrets are excluded.

Clone and update
git clone YOUR_GITHUB_URL
cd PROJECT_FOLDER
git remote -v
git fetch origin
git pull origin main
git status
git add .
git commit -m "Update application"
git push origin main
Branches, merging and history
git branch
git branch -a
git switch -c feature
git switch main
git merge feature
git push origin main
git branch -d feature
git push origin --delete feature
git log --oneline --graph --all
git diff
git diff --staged
git show HEAD
Delete branches only after confirming their work is preserved. For a merge conflict, edit conflicting files, then git add . and git commit; use git merge --abort to cancel an in-progress merge.

Undo, stash, tags and remote management
git restore FILE_NAME             # Discard unstaged changes to this file
git restore --staged FILE_NAME    # Unstage without deleting local changes
git revert COMMIT_HASH             # Create a commit reversing an earlier commit
git stash push -u
git stash list
git stash pop
git tag v1.0
git push origin v1.0
git remote set-url origin YOUR_GITHUB_URL
git fetch --prune origin
Avoid git reset --hard and force pushing unless you understand the risk of losing work. GitHub HTTPS pushes require suitable authentication (e.g. credential manager or token); public clones usually do not require credentials.

Example .gitignore (adapt to project):

.env
.env.*
!.env.example
node_modules/
.venv/
__pycache__/
*.log
target/
dist/
If .env was already tracked, git rm --cached .env removes it from the next commit without deleting the local file. Previously exposed credentials must be rotated; ignoring a file does not erase history.

2. Maven
java -version
mvn -version
mvn clean
mvn validate
mvn compile
mvn test
mvn package
mvn verify
mvn install
mvn clean install
mvn clean package
mvn package -DskipTests
mvn dependency:tree
mvn help:effective-pom
mvn site
mvn -f subfolder/pom.xml clean package
Goal	Meaning
clean	Remove previous target output
compile	Compile source code
test	Run unit tests
package	Generate JAR/WAR in target/
install	Install built artifact into local Maven repository
Create projects in Eclipse: File > New > Maven Project, choose maven-archetype-quickstart for Java or maven-archetype-webapp for JSP/web applications. Right-click project > Maven > Update Project, then Run As > Maven Build > Goals: clean package.

Java 21 POM setting (inside <project>):

<properties>
    <maven.compiler.release>21</maven.compiler.release>
</properties>
Use a compatible compiler plugin (e.g. 3.13.0). Set <packaging>war</packaging> for a web project; use a modern WAR plugin (e.g. 3.4.0). For an executable JAR, configure the JAR manifest main class, then run java -jar target/APP.jar. Dependencies may require a fat JAR or separate classpath.

3. Tomcat
Open conf/server.xml in the Tomcat installation and check the HTTP Connector. Example standalone port (choose a free one):

<Connector port="8090" protocol="HTTP/1.1"
           connectionTimeout="20000" redirectPort="8443" />
Windows CMD (adjust installation path):

cd /d "E:\apache-tomcat-9.0.120-windows-x64\apache-tomcat-9.0.120\bin"
startup.bat
For troubleshooting use catalina.bat run instead of startup.bat; keep the terminal open. Stop with shutdown.bat (or Ctrl+C for foreground run). Do not start a duplicate instance.

netstat -ano | findstr :8090
Copy a WAR into webapps/ to deploy manually. LibraryRegistration.war normally opens at http://localhost:8090/LibraryRegistration/. ROOT.war deploys at / (remove conflicting ROOT app if necessary).

For Jenkins deployment, add separate users inside conf/tomcat-users.xml before </tomcat-users>:

<role rolename="manager-script"/>
<role rolename="manager-gui"/>
<user username="jenkins" password="CHANGE_ME" roles="manager-script"/>
<user username="admin" password="CHANGE_ME_TOO" roles="manager-gui"/>
Restart Tomcat. Verify http://localhost:8090/manager/text/list with manager-script credentials. Expected: OK - Listed applications.... Use manager-gui credentials for /manager/html. Keep management interfaces local and do not commit credentials.

4. Docker CLI and Docker Hub
Start Docker Desktop first.

docker --version
docker info
docker pull nginx:latest
docker images
docker run -d --name web -p 8086:80 nginx:latest
docker ps
docker ps -a
docker inspect web
docker port web
docker logs web
docker logs -f web
docker stats
docker exec -it web sh
docker stop web
docker start web
docker restart web
docker stop web
docker rm web
docker rmi nginx:latest
-d = background; -p HOST:CONTAINER = port mapping; -it = interactive terminal. docker run creates a new container; docker start starts an existing one.

Build and publish image
Run in the directory containing Dockerfile:

docker build -t myapp:1.0 .
docker run -d --name myapp -p 8087:8080 myapp:1.0
docker login
docker tag myapp:1.0 YOUR_DOCKERHUB_USER/myapp:1.0
docker push YOUR_DOCKERHUB_USER/myapp:1.0
docker pull YOUR_DOCKERHUB_USER/myapp:1.0
docker logout
Networking and persistent storage
docker network ls
docker network create library-net
docker network inspect library-net
docker network connect library-net EXISTING_CONTAINER
docker network disconnect library-net EXISTING_CONTAINER
docker volume ls
docker volume create mysql-data
docker volume inspect mysql-data
Example two connected containers:

docker run -d --name mysql-db --network library-net -e MYSQL_ROOT_PASSWORD=root123 -e MYSQL_DATABASE=wordpress -e MYSQL_USER=wordpress -e MYSQL_PASSWORD=wordpress123 -v mysql-data:/var/lib/mysql mysql:8.0
docker run -d --name wordpress-app --network library-net -p 8081:80 -e WORDPRESS_DB_HOST=mysql-db:3306 -e WORDPRESS_DB_USER=wordpress -e WORDPRESS_DB_PASSWORD=wordpress123 -e WORDPRESS_DB_NAME=wordpress wordpress:latest
docker exec -it mysql-db mysql -u wordpress -p wordpress
Open http://localhost:8081 after MySQL initializes. Passwords are local practice examples only. If the network or container already exists, reuse it or choose another name. Cleanup: stop and remove both containers, then docker network rm library-net. docker volume rm mysql-data deletes saved database data; only use if intended.

Image transfer and cleanup
docker save -o myapp.tar myapp:1.0
docker load -i myapp.tar
docker system df
docker container prune
docker image prune
docker ps --filter publish=8080
Prune commands remove unused resources; review their prompts. Avoid deleting volumes unless you intend to lose data.

5. Dockerfile
Example A: Java WAR on Tomcat 9 + JDK 21
Copy your Maven-generated WAR into a folder with this file. Name it course-web.war.

# Dockerfile
FROM tomcat:9.0-jdk21-temurin
COPY course-web.war /usr/local/tomcat/webapps/ROOT.war
EXPOSE 8080
docker build -t course-web:1.0 .
docker run -d --name course-web -p 8085:8080 course-web:1.0
Open http://localhost:8085/. A WAR using the database hostname db requires the Compose setup in section 6, not this standalone run.

Example B: Flask application
app.py:

from flask import Flask
app = Flask(__name__)

@app.route('/')
def home():
    return 'Hello from Flask + Docker!'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
Dockerfile (in same directory):

FROM python:3.10-slim
WORKDIR /app
COPY app.py .
RUN pip install flask
EXPOSE 5000
CMD ["python", "app.py"]
docker build -t flaskapp .
docker run -d --name flask-web -p 5000:5000 flaskapp
Open http://localhost:5000/. Python is case-sensitive: Flask, not FLASK or FLask.

Dockerfile instructions
Instruction	Purpose
FROM	Base image
WORKDIR	Working directory
COPY	Copy local files into image
RUN	Execute build-time commands
EXPOSE	Document container port
ENV	Set environment variable
CMD	Default runtime command
ENTRYPOINT	Main executable
6. Docker Compose
Modern syntax: docker compose (space). YAML uses spaces, not tabs. ports, volumes and short-form depends_on are lists with a hyphen followed by a space.

Example A: Nginx + PostgreSQL + Redis
docker-compose.yml:

services:
  web:
    image: nginx:latest
    ports:
      - "8086:80"
    depends_on:
      - db
      - redis
    networks:
      - app-net
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: demo
      POSTGRES_PASSWORD: demo
      POSTGRES_DB: demo_db
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - app-net
  redis:
    image: redis:alpine
    networks:
      - app-net
networks:
  app-net:
volumes:
  db-data:
docker compose config
docker compose pull                 # Optional: images also pulled when needed
docker compose up -d
docker compose ps
docker compose ps -a
docker compose logs web
docker compose logs -f db
docker compose exec db psql -U demo -d demo_db
docker compose exec redis redis-cli
The Nginx welcome page does not actually query PostgreSQL or Redis; the exercise demonstrates running services and networking.

In PostgreSQL:

CREATE TABLE students (id INT, name VARCHAR(50));
INSERT INTO students VALUES (1, 'Student');
SELECT * FROM students;
\q
docker compose down followed by docker compose up -d preserves records in the named volume.

Example B: Flask + PostgreSQL
Use Flask app.py and Dockerfile from section 5. Create docker-compose.yml in that folder:

services:
  web:
    build: .
    ports:
      - "5000:5000"
    depends_on:
      - db
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: demo
      POSTGRES_PASSWORD: demo
      POSTGRES_DB: demo_db
    volumes:
      - db-data:/var/lib/postgresql/data
volumes:
  db-data:
docker compose up -d --build
docker compose ps
docker compose logs web
docker compose up -d --build --no-deps web
Open http://localhost:5000/. This Flask example does not query PostgreSQL. Rebuild after changing app.py because it is copied into the image.

Example C: Java WAR + MySQL (external exam)
Folder: compose-java/ containing Dockerfile (Java example in section 5), course-web.war, init.sql, docker-compose.yml.

Add this dependency inside <dependencies> in Maven pom.xml:

<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <version>8.4.0</version>
</dependency>
Set <packaging>war</packaging> and <finalName>course-web</finalName> inside <build> in your Maven web POM. For Tomcat 9 use javax.servlet-api 4.0.1 with provided scope if servlet classes are required. Build using mvn clean package or Eclipse Maven Build.

src/main/webapp/index.jsp (simple lab example):

<%@ page import="java.sql.*" %>
<html><body>
<h1>Course Details</h1>
<%
Class.forName("com.mysql.cj.jdbc.Driver");
try (Connection con = DriverManager.getConnection(
        "jdbc:mysql://db:3306/college", "student", "student123");
     Statement st = con.createStatement();
     ResultSet rs = st.executeQuery("SELECT * FROM courses")) {
    while (rs.next()) {
        out.println(rs.getInt("id") + " - " + rs.getString("name") + "<br>");
    }
}
%>
</body></html>
Use only trusted demo data in this example (production applications should escape output and keep DB credentials outside JSP).

init.sql:

USE college;
CREATE TABLE courses (id INT PRIMARY KEY, name VARCHAR(100));
INSERT INTO courses VALUES (101, 'Software Engineering'), (102, 'Computer Networks');
docker-compose.yml:

services:
  web:
    build: .
    ports:
      - "8085:8080"
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-net
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: college
      MYSQL_USER: student
      MYSQL_PASSWORD: student123
    volumes:
      - mysql-data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - app-net
    healthcheck:
      test: ["CMD", "mysql", "-h", "127.0.0.1", "-ustudent", "-pstudent123", "college", "-e", "SELECT 1"]
      interval: 5s
      timeout: 5s
      retries: 20
networks:
  app-net:
volumes:
  mysql-data:
docker compose up -d --build
docker compose ps
docker compose logs web
docker compose exec db mysql -u student -p college
Enter student123 at the prompt. Run SELECT * FROM courses;, then INSERT INTO courses VALUES (103, 'Web Technologies');. Refresh http://localhost:8085/ to demonstrate actual database connectivity. MySQL init.sql runs only on a fresh data directory. The hostname db is the Compose service name, not localhost.

General Compose commands
docker compose up -d
docker compose up -d --build
docker compose ps -a
docker compose logs
docker compose logs --tail 50 web
docker compose exec web sh
docker compose stop
docker compose start
docker compose restart
docker compose down
docker compose up -d --remove-orphans
docker compose down -v             # WARNING: deletes project volumes and data
Scaling: docker compose up -d --scale web=3 requires a service without a fixed host port conflict (remove the fixed host mapping or use dynamic ports). Basic depends_on controls startup order, not readiness; use healthcheck for readiness.

7. Jenkins
Open http://localhost:8080. Configure Manage Jenkins > Tools: Maven name MAVEN-HOME (must match script), Maven home E:\apache-maven-3.9.16 or actual path. Verify JDK and Git installations. Required plugins depend on task: Git, Pipeline, JUnit, Copy Artifact, Deploy to container, Email Extension.

Freestyle job (Experiment 8)
New Item > Freestyle project > Build_Java.
Source Code Management > Git: https://github.com/jenkins-docs/simple-java-maven-app.git, branch */master (verify actual branch), credentials None for public repository.
Build Steps > Invoke top-level Maven targets > Maven: MAVEN-HOME, goals: clean install.
Post-build Actions > Archive artifacts: target/*.jar (WAR for web).
Publish JUnit results: target/surefire-reports/*.xml (if reports exist).
Apply > Save > Build Now > Console Output.
For separate Build, Test and Deploy jobs: archive required project files and artifacts in Build; trigger Test on stable build; Test copies Build artifacts into a clean workspace, runs mvn test, archives artifacts including the WAR, then triggers Deploy on stable result. Deploy copies Test artifacts and deploys target/*.war with Deploy to container plugin. Set Tomcat 9.x Remote, manager-script credentials, base URL http://localhost:8090, context /Webpath. Verify Tomcat Manager API first. Application URL: http://localhost:8090/Webpath/.

Declarative Pipeline (Experiment 9)
New Item > Pipeline > Configure > Pipeline script. Paste:

pipeline {
    agent any
    tools {
        maven 'MAVEN-HOME'
    }
    stages {
        stage('Checkout') {
            steps {
                deleteDir()
                git branch: 'master', url: 'https://github.com/jenkins-docs/simple-java-maven-app.git'
            }
        }
        stage('Clean') {
            steps { bat 'mvn clean' }
        }
        stage('Compile') {
            steps { bat 'mvn compile' }
        }
        stage('Test') {
            steps { bat 'mvn test' }
        }
        stage('Package') {
            steps { bat 'mvn package' }
        }
        stage('Archive') {
            steps { archiveArtifacts artifacts: 'target/*.jar' }
        }
    }
    post {
        success { echo 'Build successful' }
        failure { echo 'Build failed' }
        always { echo "Build number: ${env.BUILD_NUMBER}" }
    }
}
For a WAR project change URL, branch and archive pattern. Use sh instead of bat on Linux. To demonstrate failure temporarily add bat 'exit /b 1' to Test, then remove it. mvn install includes test and package already.

Scripted Pipeline (actual Scripted syntax)
node {
    def mavenHome = tool 'MAVEN-HOME'
    withEnv(["PATH+MAVEN=${mavenHome}/bin"]) {
        stage('Checkout') {
            deleteDir()
            git branch: 'master', url: 'https://github.com/jenkins-docs/simple-java-maven-app.git'
        }
        stage('Build') { bat 'mvn clean compile' }
        stage('Test') { bat 'mvn test' }
        stage('Package') { bat 'mvn package' }
        stage('Archive') { archiveArtifacts artifacts: 'target/*.jar' }
    }
}
Triggers and email (Experiment 11)
Trigger	Example / purpose
Build periodically	0 18 * * * daily at 6 PM in Jenkins timezone
Poll SCM	H/5 * * * * check Git changes every five minutes
GitHub hook trigger	Trigger on GitHub push via reachable webhook
Upstream job	Run after another job completes
GitHub webhook: repository Settings > Webhooks > Add webhook > payload URL https://YOUR_REACHABLE_JENKINS/github-webhook/, content type application/json, push event. Enable GitHub hook trigger in Jenkins. Localhost alone is not reachable by GitHub; a securely configured tunnel or reachable server is needed. Do not expose an unsecured Jenkins instance.

Email: Manage Jenkins > System > Extended E-mail Notification / E-mail Notification. For Gmail, use smtp.gmail.com, port 587 with STARTTLS, or port 465 with SSL; use supported authentication (e.g. app password if enabled), stored securely. Test configuration. For Freestyle add Editable Email Notification post-build action and choose success/failure triggers. For Declarative Pipeline with Email Extension plugin, add inside post (replace address):

success {
    emailext to: 'team@example.com', subject: 'Build successful', body: "${env.JOB_NAME} #${env.BUILD_NUMBER} succeeded. ${env.BUILD_URL}"
}
failure {
    emailext to: 'team@example.com', subject: 'Build failed', body: "${env.JOB_NAME} #${env.BUILD_NUMBER} failed. ${env.BUILD_URL}"
}
8. Kubernetes and Minikube
Start cluster and deploy Nginx
minikube version
kubectl version --client
minikube start --driver=docker
minikube status
kubectl config current-context
kubectl get nodes
kubectl create deployment mynginx --image=nginx:1.27 --replicas=2
kubectl get deployments
kubectl get pods -o wide
kubectl expose deployment mynginx --type=NodePort --port=80 --target-port=80
kubectl get svc
kubectl scale deployment mynginx --replicas=5
kubectl get pods
kubectl rollout status deployment/mynginx
The manual's exercise scales to four replicas; use --replicas=4 for that question. Here two to five follows the additional external scenario. Choose a different free host port if 8086 is in use by Docker.

kubectl port-forward svc/mynginx 8086:80
Keep terminal open; visit http://localhost:8086. Alternatively run minikube service mynginx --url (keep tunnel terminal open on Windows). Port-forward is local access to a selected pod, not a load-balancing demo.

Self-healing, rolling update and rollback
kubectl get pods
kubectl delete pod POD_NAME
kubectl get pods -w
Replace POD_NAME with actual pod name. Deployment recreates a replacement. Ctrl+C ends watch.

kubectl set image deployment/mynginx nginx=nginx:1.28
kubectl rollout status deployment/mynginx
kubectl rollout history deployment/mynginx
kubectl rollout undo deployment/mynginx
kubectl rollout status deployment/mynginx
kubectl scale deployment mynginx --replicas=2
Debugging
kubectl get all
kubectl get pods -A
kubectl describe deployment mynginx
kubectl describe pod POD_NAME
kubectl logs POD_NAME
kubectl logs POD_NAME --previous
kubectl get events --sort-by=.metadata.creationTimest

## 📞 Support

**Issue Templates:**

1. **Low accuracy:** Include preprocessed image from debug output
2. **Performance:** Include image size and processing time
3. **Google Vision:** Share error from `GOOGLE_APPLICATION_CREDENTIALS`
4. **Data parsing:** Share excerpt from OCR text (raw output)

## 🎁 Pro Tips

1. **Improve accuracy by 10%**: Use preprocessing + Google Vision
2. **Speed up 5x**: Use Google Vision API instead of Tesseract
3. **Save money**: Use Tesseract for development, Google Vision for production
4. **Better Indian receipts**: Set `useIndianParser: true`
5. **Batch processing**: Always use concurrency limit (2-4) to avoid memory issues
6. **Mobile users**: Compress images before upload (< 2MB)
7. **Monitoring**: Track `confidence` score over time to catch quality drops

---

**Last Updated:** April 16, 2024
**Version:** 2.0 (Enhanced with preprocessing + multiple OCR providers)
