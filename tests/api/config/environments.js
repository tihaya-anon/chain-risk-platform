/**
 * Environment configuration for k6 API tests
 * Supports local, docker, and remote environments
 */

const environments = {
    local: {
        queryService: 'http://localhost:8081',
        riskMlService: 'http://localhost:8082',
        alertService: 'http://localhost:8083',
        graphService: 'http://localhost:8084',
        orchestrator: 'http://localhost:8080',
        bff: 'http://localhost:3001',
    },
    docker: {
        queryService: 'http://query-service:8081',
        riskMlService: 'http://risk-ml-service:8082',
        alertService: 'http://alert-service:8083',
        graphService: 'http://graph-service:8084',
        orchestrator: 'http://orchestrator:8080',
        bff: 'http://bff:3001',
    },
    remote: {
        queryService: `http://${__ENV.DOCKER_HOST_IP || 'localhost'}:8081`,
        riskMlService: `http://${__ENV.DOCKER_HOST_IP || 'localhost'}:8082`,
        alertService: `http://${__ENV.DOCKER_HOST_IP || 'localhost'}:8083`,
        graphService: `http://${__ENV.DOCKER_HOST_IP || 'localhost'}:8084`,
        orchestrator: `http://${__ENV.DOCKER_HOST_IP || 'localhost'}:8080`,
        bff: `http://${__ENV.DOCKER_HOST_IP || 'localhost'}:3401`,
    },
};

const ENV = __ENV.TEST_ENV || 'remote';

export function getEnv() {
    return environments[ENV] || environments.remote;
}

export function getBaseUrl(service) {
    const env = getEnv();
    const urls = {
        'query-service': env.queryService,
        'risk-ml-service': env.riskMlService,
        'alert-service': env.alertService,
        'graph-service': env.graphService,
        'orchestrator': env.orchestrator,
        'bff': env.bff,
    };
    return urls[service] || env.bff;
}

export function getBffHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-User-Id': __ENV.TEST_USER_ID || '1',
        'X-User-Username': __ENV.TEST_USERNAME || 'testuser',
        'X-User-Role': __ENV.TEST_ROLE || 'admin',
    };
}

export default { getEnv, getBaseUrl, getBffHeaders };
