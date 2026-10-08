# Stage 1: Build JAR with Maven from repository root
FROM eclipse-temurin:19-jdk-alpine AS builder
WORKDIR /workspace

COPY backend/mvnw backend/
COPY backend/.mvn backend/.mvn
COPY backend/pom.xml backend/
WORKDIR /workspace/backend
RUN chmod +x mvnw

COPY backend/src src
RUN ./mvnw clean package -DskipTests

# Stage 2: Minimal Runtime Image
FROM eclipse-temurin:19-jre-alpine
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=builder /workspace/backend/target/*.jar app.jar

ENV PORT=8080
ENV JAVA_OPTS="-Xms128m -Xmx256m -XX:MaxMetaspaceSize=96m -XX:+UseSerialGC -Xss256k -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080 10000

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -Djava.security.egd=file:/dev/./urandom -jar app.jar"]
