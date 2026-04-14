<<<<<<< HEAD
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

=======
FROM python:3.12-slim

WORKDIR /app

>>>>>>> origin/main
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

<<<<<<< HEAD
EXPOSE 8000

=======
>>>>>>> origin/main
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
