package handler

import "github.com/gin-gonic/gin"

// HTTPMethod represents HTTP methods
type HTTPMethod string

const (
	GET     HTTPMethod = "GET"
	POST    HTTPMethod = "POST"
	PUT     HTTPMethod = "PUT"
	DELETE  HTTPMethod = "DELETE"
	PATCH   HTTPMethod = "PATCH"
	OPTIONS HTTPMethod = "OPTIONS"
	HEAD    HTTPMethod = "HEAD"
)

// Route defines a single route configuration
type Route struct {
	Method  HTTPMethod      // HTTP method (GET, POST, etc.)
	Path    string          // URL path (e.g., "/:id", "/tx/:txHash")
	Handler gin.HandlerFunc // Handler function
}

// RouteGroup defines a group of routes with a common prefix
type RouteGroup struct {
	Prefix string  // Group prefix (e.g., "/transfers", "/addresses")
	Routes []Route // Routes in this group
}

// RouteRegistrar interface for handlers that can register their own routes
type RouteRegistrar interface {
	// RegisterRoutes returns the route group configuration for this handler
	RegisterRoutes() RouteGroup
}

// RegisterRouteGroup registers a RouteGroup to a gin RouterGroup
func RegisterRouteGroup(parent *gin.RouterGroup, rg RouteGroup) {
	group := parent.Group(rg.Prefix)
	for _, route := range rg.Routes {
		registerRoute(group, route)
	}
}

// registerRoute registers a single route to a gin RouterGroup
func registerRoute(group *gin.RouterGroup, route Route) {
	switch route.Method {
	case GET:
		group.GET(route.Path, route.Handler)
	case POST:
		group.POST(route.Path, route.Handler)
	case PUT:
		group.PUT(route.Path, route.Handler)
	case DELETE:
		group.DELETE(route.Path, route.Handler)
	case PATCH:
		group.PATCH(route.Path, route.Handler)
	case OPTIONS:
		group.OPTIONS(route.Path, route.Handler)
	case HEAD:
		group.HEAD(route.Path, route.Handler)
	}
}

// RegisterAll registers multiple RouteRegistrars to a gin RouterGroup
func RegisterAll(parent *gin.RouterGroup, registrars ...RouteRegistrar) {
	for _, r := range registrars {
		RegisterRouteGroup(parent, r.RegisterRoutes())
	}
}
