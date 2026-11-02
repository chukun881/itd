FROM public.ecr.aws/lambda/nodejs:20-arm64

WORKDIR ${LAMBDA_TASK_ROOT}

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/lib/compression.ts ./compression.ts
COPY docker/lambda/handler.ts ./index.ts

CMD [ "index.handler" ]
