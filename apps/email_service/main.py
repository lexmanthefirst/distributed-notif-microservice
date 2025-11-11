from fastapi import FastAPI

app = FastAPI(title="Email Service")

@app.get("/health")
async def health():
    return {"status": "ok"}
@app.get("/")
async def root():
    return {"message": "Email Service is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
