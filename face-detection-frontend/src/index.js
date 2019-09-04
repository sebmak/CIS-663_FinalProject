import React, { Fragment } from 'react';
import ReactDOM from 'react-dom';
import App from 'App';
import Signin from 'Signin';
import * as serviceWorker from 'serviceWorker';
import { API } from 'options';

import { createGlobalStyle } from 'styled-components'
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import StreamContext from 'stream-context';

const MODEL_URL = '/models'

const GlobalStyle = createGlobalStyle`
  body, html {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
  }
`

Object.defineProperty(HTMLMediaElement.prototype, 'playing', {
    get: function(){
        return !!(this.currentTime > 1 && !this.paused && !this.ended && this.readyState > 2);
    }
})
CanvasRenderingContext2D.prototype.clear =
  CanvasRenderingContext2D.prototype.clear || function (preserveTransform) {
    if (preserveTransform) {
      this.save();
      this.setTransform(1, 0, 0, 1, 0, 0);
    }

    this.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (preserveTransform) {
      this.restore();
    }
};


class Index extends React.Component {
  state = {
    loading: true,
    inputSize: 224,
    scoreThreshold: 0.75,
    debug: false
  }

  constructor(...params) {
    super(...params)

    this.videoRef = React.createRef();
  }

  componentDidMount() {
    this.load();
  }

  componentWillUnmount() {
    try {
      this.state.stream.getTracks().forEach((track) => {
        track.stop();
      });
    } catch (e) {
      console.error(e);
    }
  }

  handleChange = (e) => {
    let value = e.target.value;
    if (e.target.type === 'checkbox') {
      value = e.target.checked
      if (!value) {
        this.canvasRef.current.getContext("2d").clear(true);
      }
    }

    this.setState({
      [e.target.name]: value
    });
  }

  load = async () => {
    this.setState({
      loading: true
    })

    await API.loadFromUri(MODEL_URL)
    await window.faceapi.loadFaceLandmarkModel(MODEL_URL)
    await window.faceapi.loadFaceRecognitionModel(MODEL_URL)

    this.setState({
      loading: false,
      stream: await navigator.mediaDevices.getUserMedia({ video: {} })
    });
  }

  render() {
    if (this.state.loading) {
      return <h1>Loading</h1>
    }

    return (
      <StreamContext.Provider value={{stream: this.state.stream}}>
        <GlobalStyle />
        <Router>
          <Switch>
            <Route path="/register" component={App} />
            <Route path="/" component={Signin} exact />
          </Switch>
        </Router>
      </StreamContext.Provider>
    )
  }
}

ReactDOM.render(<Index />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
