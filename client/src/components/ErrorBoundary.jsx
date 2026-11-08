import { Component } from 'react';
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('UI crashed', error, info); }
  render() {
    if (this.state.error) return <div className="panel empty"><h3>The game view crashed</h3><p className="muted">{String(this.state.error.message)}</p><button className="btn btn-primary" onClick={() => this.setState({ error: null })}>Try again</button></div>;
    return this.props.children;
  }
}
