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
)

// Route defines a single route configuration
type Route struct {
	Method  HTTPMethod
	Path    string
	Handler gin.HandlerFunc
}

// RouteGroup defines a group of routes with a common prefix
type RouteGroup struct {
	Prefix string
	Routes []Route
}

// RouteRegistrar interface for handlers that register routes
type RouteRegistrar interface {
	RegisterRoutes() RouteGroup
}

// RegisterRouteGroup registers a RouteGroup to a gin RouterGroup
func RegisterRouteGroup(parent *gin.RouterGroup, rg RouteGroup) {
	group := parent.Group(rg.Prefix)
	for _, route := range rg.Routes {
		registerRoute(group, route)
	}
}

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
	}
}

// RegisterAll registers multiple RouteRegistrars
func RegisterAll(parent *gin.RouterGroup, registrars ...RouteRegistrar) {
	for _, r := range registrars {
		RegisterRouteGroup(parent, r.RegisterRoutes())
	}
}
