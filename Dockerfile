FROM alpine:latest
ARG DATABASE_URL
ENV POSTGRES_URL=$DATABASE_URL
RUN apk update && \
    apk add postgresql && \
    apk add postgresql-contrib
CMD psql $POSTGRES_URL
