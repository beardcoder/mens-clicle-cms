import { render } from 'preact'
import { App } from './App'
import { boot, toastError } from './state'
import './admin.css'

render(<App />, document.getElementById('app')!)
boot().catch(toastError)
