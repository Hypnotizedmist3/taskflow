pipeline {
    agent any
    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }
    environment {
        BACKEND_IMAGE_NAME  = "taskflow-backend"
        FRONTEND_IMAGE_NAME = "taskflow-frontend"
        REGISTRY            = "localhost:5061"
        SONAR_PROJECT_KEY   = "taskflow"
        BUILD_VERSION       = "1.0.${BUILD_NUMBER}"
        PATH                = "/usr/local/bin:/opt/homebrew/bin:${env.PATH}"
    }
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    def sha = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
                    env.GIT_SHORT_SHA = sha
                    echo "Building commit ${env.GIT_SHORT_SHA} as version ${env.BUILD_VERSION}"
                }
                sh 'mkdir -p reports'
                sh 'chmod +x scripts/*.sh'
            }
        }
        stage('Build') {
            steps {
                // Backend: a "dev" image (full devDependencies, used for
                // Test/Lint/Audit) and a lean "prod" image (the real deploy
                // artifact).
                sh """
                    docker build -f backend/Dockerfile --target dev \
                        -t ${env.BACKEND_IMAGE_NAME}-dev:${env.BUILD_VERSION} backend
                """
                sh """
                    docker build -f backend/Dockerfile --target prod \
                        -t ${env.BACKEND_IMAGE_NAME}:${env.BUILD_VERSION} \
                        -t ${env.BACKEND_IMAGE_NAME}:${env.GIT_SHORT_SHA} \
                        -t ${env.BACKEND_IMAGE_NAME}:latest backend
                """
                // Frontend: same split — "dev" for linting, "prod" (nginx +
                // static build) for deployment.
                sh """
                    docker build -f frontend/Dockerfile --target dev \
                        -t ${env.FRONTEND_IMAGE_NAME}-dev:${env.BUILD_VERSION} frontend
                """
                sh """
                    docker build -f frontend/Dockerfile --target prod \
                        -t ${env.FRONTEND_IMAGE_NAME}:${env.BUILD_VERSION} \
                        -t ${env.FRONTEND_IMAGE_NAME}:${env.GIT_SHORT_SHA} \
                        -t ${env.FRONTEND_IMAGE_NAME}:latest frontend
                """
                sh """
                    docker tag ${env.BACKEND_IMAGE_NAME}:${env.BUILD_VERSION} ${env.REGISTRY}/${env.BACKEND_IMAGE_NAME}:${env.BUILD_VERSION}
                    docker tag ${env.FRONTEND_IMAGE_NAME}:${env.BUILD_VERSION} ${env.REGISTRY}/${env.FRONTEND_IMAGE_NAME}:${env.BUILD_VERSION}
                    docker push ${env.REGISTRY}/${env.BACKEND_IMAGE_NAME}:${env.BUILD_VERSION} || echo 'Registry not running yet — see SETUP.md'
                    docker push ${env.REGISTRY}/${env.FRONTEND_IMAGE_NAME}:${env.BUILD_VERSION} || echo 'Registry not running yet — see SETUP.md'
                """
            }
        }
        stage('Test') {
            steps {
                sh "DEV_IMAGE=${env.BACKEND_IMAGE_NAME}-dev:${env.BUILD_VERSION} ./scripts/test.sh"
            }
            post {
                always {
                    sh './scripts/test-cleanup.sh || true'
                }
            }
        }
        stage('Code Quality') {
            environment { SCANNER_HOME = tool 'SonarScanner' }
            steps {
                // Report files are captured from the containers' stdout,
                // never by bind-mounting the source tree over /app — doing
                // that would hide the image's own baked-in node_modules
                // behind the host checkout (which has none), the exact bug
                // that broke an earlier project's Build stage.
                sh """
                    docker run --rm ${env.BACKEND_IMAGE_NAME}-dev:${env.BUILD_VERSION} \
                        npx eslint src test -f json > reports/eslint.json || true
                """
                sh """
                    docker run --rm ${env.FRONTEND_IMAGE_NAME}-dev:${env.BUILD_VERSION} \
                        npx oxlint --format json src > reports/oxlint.json || true
                """
                withSonarQubeEnv('LocalSonarQube') {
                    sh "${env.SCANNER_HOME}/bin/sonar-scanner -Dsonar.projectVersion=${env.BUILD_VERSION}"
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/eslint.json,reports/oxlint.json', allowEmptyArchive: true
                }
            }
        }
        stage('Quality Gate') {
            steps { timeout(time: 5, unit: 'MINUTES') { waitForQualityGate abortPipeline: true } }
        }
        stage('Security') {
            steps {
                sh 'chmod +x scripts/*.sh'
                sh './scripts/install-trivy.sh'
                sh """
                    docker run --rm ${env.BACKEND_IMAGE_NAME}-dev:${env.BUILD_VERSION} \
                        npm audit --omit=dev --json > reports/npm-audit-backend.json || true
                """
                sh """
                    docker run --rm ${env.FRONTEND_IMAGE_NAME}-dev:${env.BUILD_VERSION} \
                        npm audit --omit=dev --json > reports/npm-audit-frontend.json || true
                """
                sh """
                    BACKEND_IMAGE=${env.BACKEND_IMAGE_NAME}:${env.BUILD_VERSION} \
                    FRONTEND_IMAGE=${env.FRONTEND_IMAGE_NAME}:${env.BUILD_VERSION} \
                    ./scripts/security-scan.sh
                """
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/npm-audit-*.json,reports/trivy-*.json', allowEmptyArchive: true
                }
            }
        }
        stage('Deploy') {
            steps {
                sh """
                    BACKEND_IMAGE_NAME=${env.BACKEND_IMAGE_NAME} \
                    FRONTEND_IMAGE_NAME=${env.FRONTEND_IMAGE_NAME} \
                    JWT_SECRET=${env.JWT_SECRET ?: 'staging-secret-please-override'} \
                    ./scripts/deploy.sh staging ${env.BUILD_VERSION}
                """
            }
        }
        stage('Release') {
            steps {
                sh """
                    BACKEND_IMAGE_NAME=${env.BACKEND_IMAGE_NAME} \
                    FRONTEND_IMAGE_NAME=${env.FRONTEND_IMAGE_NAME} \
                    REGISTRY=${env.REGISTRY} \
                    ./scripts/release.sh ${env.BUILD_VERSION}
                """
                sh """
                    git tag -a v${env.BUILD_VERSION} -m "Automated release ${env.BUILD_VERSION} (${env.GIT_SHORT_SHA})" || true
                    git push origin v${env.BUILD_VERSION} || echo 'Configure git push credentials in Jenkins to enable tag push'
                """
            }
        }
        stage('Monitoring') {
            steps {
                sh 'chmod +x scripts/*.sh'
                sh './scripts/monitoring-check.sh'
            }
        }
    }
    post {
        failure {
            echo "Pipeline failed at a stage — attempting automatic rollback of production if Release had already run"
            sh """
                BACKEND_IMAGE_NAME=${env.BACKEND_IMAGE_NAME} \
                FRONTEND_IMAGE_NAME=${env.FRONTEND_IMAGE_NAME} \
                ./scripts/rollback.sh || true
            """
        }
        always { sh 'docker image prune -f || true' }
    }
}
