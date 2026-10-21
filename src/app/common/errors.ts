export type SafeErrorDetails = Record<string, unknown>;

export class ApplicationError extends Error {
    constructor(
        readonly code: string,
        readonly status: number,
        readonly publicMessage: string,
        readonly details?: SafeErrorDetails,
        options?: ErrorOptions,
    ) {
        super(publicMessage, options);
        this.name = new.target.name;
    }
}

export class DomainError extends ApplicationError {
    constructor(code: string, publicMessage: string, status = 422, details?: SafeErrorDetails, options?: ErrorOptions) {
        super(code, status, publicMessage, details, options);
    }
}

export class RequestValidationError extends ApplicationError {
    constructor(details?: SafeErrorDetails, publicMessage = "Request validation failed") {
        super("VALIDATION_ERROR", 400, publicMessage, details);
    }
}

export class DomainValidationError extends DomainError {
    constructor(code: string, publicMessage: string, details?: SafeErrorDetails) {
        super(code, publicMessage, 422, details);
    }
}

export class AuthenticationError extends ApplicationError {
    constructor(publicMessage = "Authentication required") {
        super("AUTHENTICATION_REQUIRED", 401, publicMessage);
    }
}

export class AuthorizationError extends ApplicationError {
    constructor(publicMessage = "Access denied") {
        super("FORBIDDEN", 403, publicMessage);
    }
}

export class NotFoundError extends ApplicationError {
    constructor(publicMessage = "Resource not found") {
        super("NOT_FOUND", 404, publicMessage);
    }
}

export class ConflictError extends ApplicationError {
    constructor(publicMessage = "The request conflicts with the current resource state") {
        super("CONFLICT", 409, publicMessage);
    }
}

export class UpstreamProviderError extends ApplicationError {
    constructor(
        readonly provider: "GitHub" | "OpenRouter" | "Inngest",
        readonly providerStatus?: number,
        options?: ErrorOptions,
    ) {
        super(
            "UPSTREAM_PROVIDER_ERROR",
            providerStatus === 429 ? 503 : 502,
            "An upstream service could not complete the request",
            undefined,
            options,
        );
    }
}

export class ConfigurationError extends ApplicationError {
    constructor(details?: SafeErrorDetails) {
        super("SERVICE_CONFIGURATION_ERROR", 503, "The service is not configured correctly", details);
    }
}

export class DependencyUnavailableError extends ApplicationError {
    constructor(dependency: string, options?: ErrorOptions) {
        super("DEPENDENCY_UNAVAILABLE", 503, "A required service is temporarily unavailable", { dependency }, options);
    }
}
