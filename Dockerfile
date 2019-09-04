FROM tensorflow/tensorflow

RUN apt-get install -y build-essential
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install -y nodejs

WORKDIR /var/build
COPY . .

WORKDIR /var/build/face-detection-frontend
RUN npm install

RUN npm run build

WORKDIR /var/build

RUN cp -Rf face-detection-frontend/build face-detection-backend/ui
RUN mkdir /var/app
RUN cp -Rf /var/build/face-detection-backend/* /var/app
RUN rm -rf /var/build/

WORKDIR /var/app

RUN mkdir -p out
RUN mkdir -p accounts

RUN apt-get install -y git
RUN npm install

EXPOSE 1337
CMD ["node","/var/app/index.js"]
