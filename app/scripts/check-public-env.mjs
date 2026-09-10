const publicEnvironment = Object.entries(process.env).filter(([key]) => key.startsWith("VITE_"));
const forbidden = publicEnvironment.filter(([key, value]) =>
  /service[_-]?role|secret/i.test(`${key}=${value}`),
);

if (forbidden.length) {
  console.error(`公開環境変数に秘密鍵らしき値があります: ${forbidden.map(([key]) => key).join(", ")}`);
  process.exit(1);
}

console.log("公開環境変数チェック: OK（service role / secret keyなし）");
