export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### 手順2：`src/main.jsx` を確認する
念のため、デザインの読み込み元も確認します。
`src/main.jsx` ファイルを開き、一番上のあたりに以下の行があるか確認してください。

```javascript
import './index.css'