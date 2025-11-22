import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' // ← この行が超重要！！
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

---

### 手順3：修正をGitHubに送る
ファイルを作ったり直したりしたら、また以下の3点セットで送信です！

```bash
git add .
```

```bash
git commit -m "fix css config"
```

```bash
git push