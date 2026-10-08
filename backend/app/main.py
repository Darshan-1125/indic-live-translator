import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes.health import router as health_router
from app.websocket.endpoints import router as ws_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("app.main")

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Real-time Multilingual Communication Platform Backend",
    version="0.1.0",
    debug=settings.DEBUG,
)

# Configure CORS middleware for local React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(health_router)
app.include_router(ws_router)


@app.get("/")
async def root():
    """Root endpoint returning basic system info."""
    return {
        "app": settings.APP_NAME,
        "status": "online",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
