# Rifa Solidária — Ajude Davi e Vitória

App web simples, bonito e feito para celular, usando:

- HTML, CSS e JavaScript puro
- GitHub Pages para hospedagem
- Google Sheets como banco de dados
- Google Apps Script como API
- Google Drive para guardar comprovantes enviados pelo app

## O que esta versão faz

- Mostra a rifa em layout exclusivo para celular.
- Mostra números de 1 a 100.
- Permite escolher um ou mais números.
- Gera Pix copia e cola com o valor total escolhido.
- Gera QR Code Pix.
- Reserva os números no Google Sheets.
- Permite enviar foto, print ou PDF do comprovante pelo próprio app.
- O comprovante aparece no painel da responsável.
- O painel admin atualiza automaticamente a cada 15 segundos.
- A responsável pode confirmar pagamento, liberar número, marcar reservado, copiar pagos e exportar CSV.

> Importante: o sistema não consulta banco automaticamente. O comprovante aparece no painel, mas a conferência real do Pix deve ser feita pela responsável no banco. No arquivo `assets/config.js`, existe a opção `AUTO_CONFIRMAR_COM_COMPROVANTE`, mas o recomendado é deixar `false` para evitar golpe com comprovante falso.

---

## Estrutura dos arquivos

```txt
rifa-solidaria-davi-vitoria/
  index.html
  admin.html
  assets/
    style.css
    app.js
    admin.js
    config.js
    ilustracao-davi-vitoria.png
  apps-script/
    codigo.gs
  README.md
```

---

## 1. Criar a planilha Google Sheets

1. Acesse o Google Sheets.
2. Crie uma planilha nova.
3. Dê um nome, por exemplo:

```txt
Rifa Solidária Davi e Vitória
```

4. Crie uma aba chamada exatamente:

```txt
Numeros
```

Não precisa criar as colunas manualmente. O Apps Script cria tudo sozinho.

---

## 2. Colar o código do Apps Script

1. Na planilha, clique em **Extensões > Apps Script**.
2. Apague qualquer código que estiver lá.
3. Abra o arquivo:

```txt
apps-script/codigo.gs
```

4. Copie tudo e cole no Apps Script.
5. Clique em **Salvar**.
6. Execute manualmente a função:

```txt
inicializarPlanilha
```

7. Autorize as permissões pedidas pelo Google.

O script vai criar/preencher os números de 1 a 100 na aba `Numeros`.

---

## 3. Publicar o Apps Script como Web App

1. No Apps Script, clique em **Implantar > Nova implantação**.
2. Escolha o tipo **App da Web**.
3. Configure assim:

```txt
Executar como: eu
Quem tem acesso: qualquer pessoa
```

4. Clique em **Implantar**.
5. Copie a URL terminada em `/exec`.

---

## 4. Colar a URL no config.js

Abra o arquivo:

```txt
assets/config.js
```

Procure esta linha:

```js
API_URL: "https://script.google.com/macros/s/AKfycbxPV_Y1h0k_ZbJl5XsF2fx3v8vx-r-s9mOk5SiaCAtKu3D9Ix5F-smWYPvVfv2g0OoN/exec"
```

Troque pela URL do seu Web App, se for diferente.

Nesta versão, a URL que você enviou já está configurada.

---

## 5. Publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todos os arquivos da pasta `rifa-solidaria-davi-vitoria`.
3. No GitHub, vá em **Settings > Pages**.
4. Em **Branch**, escolha `main` e pasta `/root`.
5. Salve.
6. Aguarde o GitHub gerar o link.

Não envie só o `index.html`. Tem que enviar também a pasta `assets` e a pasta `apps-script`.

---

## 6. Usar a página pública

A pessoa acessa o `index.html` pelo celular e faz assim:

1. Escolhe os números.
2. Preenche nome e WhatsApp.
3. Clica em **Reservar meus números**.
4. Faz o Pix pelo QR Code ou Pix copia e cola.
5. Envia o comprovante/print pelo próprio app.

Os números ficam como `reservado` até a responsável confirmar no painel.

---

## 7. Usar o painel admin

Acesse:

```txt
admin.html
```

Senha inicial:

```txt
1234
```

Essa senha fica no arquivo `assets/config.js`:

```js
ADMIN_PIN: "1234"
```

No painel você pode:

- ver total confirmado
- ver números pagos
- ver comprovantes enviados
- ver reservados e livres
- abrir comprovantes
- confirmar pagamento
- liberar número
- marcar número como reservado
- copiar lista dos pagos
- exportar CSV

O painel atualiza automaticamente a cada 15 segundos.

---

## 8. Trocar Pix, valor, sorteio, prêmio e WhatsApp

Abra:

```txt
assets/config.js
```

Edite os campos:

```js
RESPONSAVEL_NOME: "Juliana",
WHATSAPP_RESPONSAVEL: "",
DATA_SORTEIO: "A definir",
PREMIO_RIFA: "A definir",
PIX_KEY: "229922848326",
PIX_RECEBEDOR: "JULIANA",
PIX_CIDADE: "CARMO",
VALOR_NUMERO: 10,
QUANTIDADE_NUMEROS: 100,
ADMIN_PIN: "1234"
```

Para WhatsApp, use DDI + DDD + número. Exemplo:

```js
WHATSAPP_RESPONSAVEL: "5522999999999"
```

---

## 9. Atualizar o Apps Script se já existia uma versão antiga

Se você já publicou uma versão anterior e agora vai usar o envio de comprovante pelo app:

1. Abra o Apps Script da planilha.
2. Substitua todo o código pelo arquivo novo `apps-script/codigo.gs`.
3. Salve.
4. Clique em **Implantar > Gerenciar implantações**.
5. Clique no lápis da implantação atual.
6. Em **Versão**, escolha **Nova versão**.
7. Clique em **Implantar**.

Assim você mantém a mesma URL `/exec`.

---

## Observação sobre confirmação automática de Pix

Este app usa GitHub Pages, Google Apps Script e Google Sheets. Ele não tem conexão oficial com banco ou sistema Pix do Banco Central.

Por isso, ele consegue automatizar:

- reserva dos números
- geração do Pix copia e cola
- geração do QR Code
- envio do comprovante
- exibição do comprovante no painel

Mas não consegue confirmar sozinho se o dinheiro caiu na conta.

Para confirmação bancária real automática, seria necessário contratar ou configurar uma API oficial de pagamento, como banco, Mercado Pago, PagBank, Efí, Asaas ou outro provedor de Pix.


## Se a versão online abrir sem visual

Se no GitHub Pages a página aparecer apenas como texto, significa que o GitHub não encontrou os arquivos da pasta `assets` ou a publicação ainda está com cache antigo. Esta versão já tem CSS, imagem e JavaScript embutidos dentro de `index.html` e `admin.html` para evitar esse problema, mas ainda assim é recomendado subir a pasta completa:

```txt
index.html
admin.html
assets/
apps-script/
README.md
```

Depois de enviar os arquivos, aguarde 1 a 3 minutos e atualize a página com `Ctrl + F5` no computador ou limpando/cache/recarregando no celular.
