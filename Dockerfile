FROM node:22.15.0-slim
LABEL org.opencontainers.image.source=https://github.com/CheckerNetwork/node
USER node
WORKDIR /usr/src/app
COPY . .
RUN npm ci --omit=dev
ENV DEPLOYMENT_TYPE=docker
CMD [ "./bin/checker.js" ]
