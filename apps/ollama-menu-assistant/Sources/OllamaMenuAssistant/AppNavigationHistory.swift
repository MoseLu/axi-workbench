import Foundation

enum AppNavigationRoute: Equatable, Sendable {
    case conversation(UUID)
    case newConversation(projectID: UUID?, allowsNoProject: Bool)
}

struct AppNavigationHistory: Equatable, Sendable {
    private(set) var routes: [AppNavigationRoute] = []
    private(set) var currentIndex: Int?

    var canGoBack: Bool {
        guard let currentIndex else {
            return false
        }
        return currentIndex > 0
    }

    var canGoForward: Bool {
        guard let currentIndex else {
            return false
        }
        return currentIndex < routes.count - 1
    }

    var currentRoute: AppNavigationRoute? {
        guard let currentIndex, routes.indices.contains(currentIndex) else {
            return nil
        }
        return routes[currentIndex]
    }

    mutating func reset(to route: AppNavigationRoute) {
        routes = [route]
        currentIndex = 0
    }

    mutating func ensureCurrentRoute(_ route: AppNavigationRoute) {
        guard let currentIndex, routes.indices.contains(currentIndex) else {
            reset(to: route)
            return
        }
        routes[currentIndex] = route
    }

    mutating func record(_ route: AppNavigationRoute) {
        if currentRoute == route {
            return
        }

        if let currentIndex {
            routes = Array(routes.prefix(currentIndex + 1))
        } else {
            routes = []
        }
        routes.append(route)
        currentIndex = routes.count - 1
    }

    mutating func replaceCurrent(with route: AppNavigationRoute) {
        guard let currentIndex, routes.indices.contains(currentIndex) else {
            reset(to: route)
            return
        }
        routes[currentIndex] = route
    }

    mutating func goBack() -> AppNavigationRoute? {
        guard canGoBack, let currentIndex else {
            return nil
        }
        self.currentIndex = currentIndex - 1
        return currentRoute
    }

    mutating func goForward() -> AppNavigationRoute? {
        guard canGoForward, let currentIndex else {
            return nil
        }
        self.currentIndex = currentIndex + 1
        return currentRoute
    }
}
