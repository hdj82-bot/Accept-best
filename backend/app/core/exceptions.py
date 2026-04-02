class AppError(Exception):
    def __init__(self, code: str, message: str, status: int = 500):
        self.code = code
        self.message = message
        self.status = status


class RateLimitError(AppError):
    def __init__(self, service: str):
        super().__init__("RATE_LIMIT", f"{service} rate limit. retry later.", 429)


class QuotaExceededError(AppError):
    def __init__(self, feature: str):
        super().__init__("QUOTA_EXCEEDED", f"{feature} monthly limit reached.", 402)


class ExternalAPIError(AppError):
    def __init__(self, service: str, detail: str = ""):
        super().__init__("EXTERNAL_API", f"{service} error: {detail}", 502)
