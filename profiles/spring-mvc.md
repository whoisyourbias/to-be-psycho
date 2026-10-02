# Spring MVC · profile version 1

Use [shared Spring Boot](spring-boot.md) when Boot is present; Boot is also shared by WebFlux.

## Repository checks
Read build files, Java/Spring versions, MVC dependencies and existing controllers/configuration. Verify servlet/MVC rather than assuming every Spring app uses it.

## Concepts
Request/response mapping, controller-service boundaries, validation/error handling, synchronous processing and test seams.

## Review questions
What status/body does each request produce? At which boundary is input rejected? Is a defect proven by code or only a missing runtime condition? Which learner-run check exercises the requirement? Never supply a whole controller or complete MockMvc test.
