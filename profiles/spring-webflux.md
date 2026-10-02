# Spring WebFlux · profile version 1

Use [shared Spring Boot](spring-boot.md) when Boot is present; do not assign a duplicate Boot course.

## Repository checks
Read Java/Spring/Reactor versions, WebFlux/server dependencies, actual stack configuration and clients/drivers. Do not infer a reactive execution context solely from a return type.

## Concepts
Publisher flow, composition vs subscription, errors, cancellation, backpressure and blocking-call risks where relevant.

## Review questions
Where is subscription owned? Is a blocking operation actually on a sensitive execution path, or is that only a risk needing context? What happens on cancellation or errors? Does the installed driver support the presumed behavior? Specify evidence and learner-run checks without a replacement reactive chain.
