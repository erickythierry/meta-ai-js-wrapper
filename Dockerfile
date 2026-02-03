FROM node:lts-alpine
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm i
RUN npm i -g typescript
RUN npm cache clean --force
COPY . .
RUN tsc
ENV TZ=America/Belem
CMD ["yarn", "server:build"]