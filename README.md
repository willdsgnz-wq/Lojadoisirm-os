# Material de Construcao Dois Irmaos

Sistema web de gestao para loja de materiais de construcao, agora preparado para rodar online com:

- `Vercel` no deploy
- `Supabase Postgres` no banco de dados
- `GitHub` como origem do codigo
- navegador como ponto de acesso no computador da loja

## O que mudou para o projeto ficar online

Antes, a aplicacao dependia de ambiente local em pontos importantes:

- `database/store.db`
  - era o banco SQLite salvo no proprio computador
- `app.py`
  - rodava como servidor local simples
- criacao automatica de tabelas e dados de exemplo no boot local
- segredo de sessao com fallback local

Agora, o fluxo foi ajustado assim:

- o backend usa `Flask`, compativel com deploy no Vercel
- o banco principal passou para `Postgres`, usando `DATABASE_URL`
- a estrutura do banco ficou em `database/schema.sql`
- a criacao inicial do banco foi separada para script proprio
- a migracao do SQLite antigo para o Postgres pode ser feita com script
- as variaveis de ambiente passaram a controlar seguranca e conexao

## Stack atual

- `Python 3`
- `Flask`
- `psycopg`
- `openpyxl`
- `reportlab`
- `Postgres / Supabase`
- `HTML + CSS + JavaScript`
- `Vercel`

## Módulos ERP já incluídos

- `Produtos`
  - SKU, categoria, nome, unidade, preços, estoque, NCM, CFOP, origem, CSOSN e ativo/inativo
  - importação de planilha Excel/CSV
  - exportação em CSV e Excel
- `Estoque`
  - entrada manual
  - saída manual
  - ajuste de inventário
  - histórico de movimentações
- `Vendas com itens`
  - cliente, itens reais, forma de pagamento, horário e baixa automática de estoque
- `NF-e`
  - validação fiscal por venda
  - provider fiscal desacoplado
  - provider `mock` pronto para homologação local
  - geração de XML e DANFE em PDF
  - download por nota emitida
- `Configurações fiscais`
  - dados do emitente
  - série padrão
  - ambiente
  - provider
  - token/URL/certificado preparados para integração futura

## Estrutura principal

```text
loja-materiais/
  app.py
  requirements.txt
  vercel.json
  .env.example
  backend/
    auth.py
    db.py
    services.py
    utils.py
  database/
    schema.sql
    seed.py
    store.db
  scripts/
    setup_database.py
    migrate_sqlite_to_postgres.py
  frontend/
    index.html
    manifest.webmanifest
    service-worker.js
    assets/
      css/
      js/
      icons/
      brand/
```

## Variaveis de ambiente

Crie estas variaveis no seu ambiente local e depois no Vercel:

- `DATABASE_URL`
  - string de conexao do Supabase
  - para Vercel, prefira a `Transaction pooler connection string`
- `SESSION_SECRET`
  - chave forte para assinar a sessao
- `APP_ENV`
  - `development` no seu computador
  - `production` no Vercel
- `COOKIE_SECURE`
  - `false` no desenvolvimento local
  - `true` em producao
- `FLASK_DEBUG`
  - `true` apenas no desenvolvimento
- `AUTO_INIT_DATABASE`
  - deixe `false` em producao
  - use `true` somente se quiser bootstrap automatico em ambiente controlado
- `SEED_DEMO_DATA`
  - `false` em producao
  - `true` apenas para colocar dados de exemplo

Arquivo modelo: [.env.example](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/.env.example)

## Banco de dados online

As tabelas principais continuam estas:

- `users`
- `products`
- `customers`
- `sales`
- `sale_items`
- `quotes`
- `quote_items`
- `expenses`
- `checks`

O schema inicial para criar tudo no Supabase esta em [database/schema.sql](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/database/schema.sql).

## Como rodar localmente com Supabase

### 1. Entre na pasta do projeto

```bat
cd C:\Users\User\Documents\Codex\2026-04-19-quero-que-voc-crie-do-zero\loja-materiais
```

### 2. Crie um arquivo `.env`

Voce pode copiar os valores de [.env.example](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/.env.example) e preencher com seus dados reais do Supabase.

Exemplo:

```env
APP_ENV=development
PORT=8000
FLASK_DEBUG=true
DATABASE_URL=COLE_AQUI_A_TRANSACTION_POOLER_CONNECTION_STRING_DO_SUPABASE
SESSION_SECRET=uma-chave-grande-e-segura
COOKIE_SECURE=false
AUTO_INIT_DATABASE=false
SEED_DEMO_DATA=false
```

### 3. Instale as dependencias

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Observação:

- `openpyxl` é usado na importação/exportação de produtos
- `reportlab` é usado para gerar o DANFE em PDF

### 4. Crie a estrutura do banco no Supabase

```bat
python scripts\setup_database.py
```

Se quiser subir tambem o usuario de teste e dados de exemplo:

```bat
python scripts\setup_database.py --with-demo-data
```

### 5. Rode o projeto

```bat
python app.py
```

Depois abra:

```text
http://127.0.0.1:8000
```

## Fluxo rápido de uso do mini ERP

### 1. Produtos

1. Acesse `Produtos`
2. Cadastre manualmente ou use `Importar planilha`
3. Revise SKU, NCM, CFOP, origem e CSOSN

### 2. Estoque

1. Acesse `Estoque`
2. Lance `ENTRADA`, `SAIDA` ou `AJUSTE`
3. Consulte o histórico em `Movimentações`

### 3. Vendas

1. Acesse `Vendas`
2. Escolha o cliente
3. Adicione os itens reais do estoque
4. Salve a venda

Ao salvar:

- o total é calculado automaticamente
- o estoque é baixado automaticamente
- os itens ficam prontos para validação fiscal

### 4. NF-e

1. Acesse `NF-e`
2. Preencha as configurações fiscais da empresa
3. Selecione uma venda com itens
4. Clique em `Validar dados`
5. Corrija pendências, se houver
6. Clique em `Emitir NF-e`

Arquivos gerados:

- XML: `storage/nfe/xml/ANO/MES/`
- PDF/DANFE: `storage/nfe/pdf/ANO/MES/`

## Provider fiscal real no futuro

A arquitetura já está preparada para plugar um provider real depois.

Arquivos principais:

- [backend/fiscal.py](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/backend/fiscal.py)
- [backend/services.py](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/backend/services.py)

Fluxo atual:

- `MockFiscalProvider` gera XML autorizado de homologação e DANFE em PDF

Para integrar um provider real depois:

1. criar uma classe nova herdando `FiscalProvider`
2. implementar `emit_nfe(...)`
3. mapear autenticação e retorno da API fiscal
4. trocar o provider salvo em `Configurações fiscais`

## Usuario de teste

Se voce rodar o seed de exemplo, o login continua:

- Usuario: `admin`
- Senha: `123456`

## Como migrar o banco SQLite antigo para o Supabase

Se voce ja tiver dados no arquivo local `database/store.db`, pode migrar para o Postgres.

### Migrar mantendo os dados atuais do Postgres

```bat
python scripts\migrate_sqlite_to_postgres.py
```

### Migrar limpando antes o banco online

```bat
python scripts\migrate_sqlite_to_postgres.py --reset-target
```

### Migrar a partir de outro arquivo SQLite

```bat
python scripts\migrate_sqlite_to_postgres.py --sqlite-path C:\caminho\outro-banco.db --reset-target
```

## Passo a passo exato para publicar no GitHub + Vercel

### 1. Criar o projeto no Supabase

1. Entre em [Supabase](https://supabase.com/).
2. Crie um novo projeto.
3. Abra `Project Settings` > `Database`.
4. Copie a `Transaction pooler connection string`.
   Motivo: ela e a indicada para uso serverless.

### 2. Criar as tabelas no Supabase

Opcao mais simples:

```bat
python scripts\setup_database.py
```

Se quiser subir dados de exemplo:

```bat
python scripts\setup_database.py --with-demo-data
```

Ou, se preferir, voce tambem pode colar o conteudo de [database/schema.sql](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/database/schema.sql) no SQL Editor do Supabase.

### 3. Subir o projeto para o GitHub

Dentro da pasta do projeto:

```bat
git init
git add .
git commit -m "Preparar deploy Vercel com Supabase"
```

Crie um repositorio no GitHub e depois rode:

```bat
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

### 4. Importar o repositorio no Vercel

1. Entre em [Vercel](https://vercel.com/).
2. Clique em `Add New Project`.
3. Escolha o repositorio do GitHub.
4. Deixe o framework como detectado automaticamente.
5. Confirme o deploy.

### 5. Configurar variaveis de ambiente no Vercel

No painel do projeto da Vercel, adicione:

- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_ENV=production`
- `COOKIE_SECURE=true`
- `AUTO_INIT_DATABASE=false`
- `SEED_DEMO_DATA=false`

`FLASK_DEBUG` nao deve ficar ativo em producao.

### 6. Fazer o primeiro deploy

Depois de salvar as variaveis:

1. Rode um novo deploy no painel da Vercel
2. ou faca um novo push no GitHub

### 7. Abrir o sistema pelo link

Quando o deploy terminar, a Vercel vai gerar um link como:

```text
https://seu-projeto.vercel.app
```

Esse passa a ser o link que o computador da loja vai abrir no navegador.

## Arquivos importantes para producao

- [app.py](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/app.py)
  - app Flask e rotas da API
- [backend/db.py](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/backend/db.py)
  - conexao com Postgres/Supabase
- [backend/services.py](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/backend/services.py)
  - regras de negocio
- [database/schema.sql](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/database/schema.sql)
  - tabelas iniciais
- [scripts/setup_database.py](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/scripts/setup_database.py)
  - cria estrutura do banco
- [scripts/migrate_sqlite_to_postgres.py](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/scripts/migrate_sqlite_to_postgres.py)
  - migra dados do SQLite antigo
- [vercel.json](C:/Users/User/Documents/Codex/2026-04-19-quero-que-voc-crie-do-zero/loja-materiais/vercel.json)
  - configuracao da Vercel

## Observacoes importantes

- O arquivo `database/store.db` virou legado. Ele nao e mais o banco principal do sistema online.
- O frontend continua funcionando no navegador do mesmo jeito, mas agora os dados podem vir de um banco remoto.
- O projeto foi preparado para publicar sem quebrar a interface atual.
- Se quiser, o proximo passo pode ser configurar dominio proprio e backup automatizado.
