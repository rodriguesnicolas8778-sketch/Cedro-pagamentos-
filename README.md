# Cedro Pagamentos

Você anexa **as fotos dos itens** e **o boleto**, e a plataforma:

1. **Lê o boleto (PDF)** e identifica o condomínio pelo CNPJ do pagador (ou pelo nome do condomínio), além do valor e do vencimento.
2. Busca no cadastro a **administradora, o contato, o operador responsável e o e-mail**, conforme a sua planilha.
3. **Envia o e-mail automaticamente** no mesmo formato que vocês já usam:
   - Assunto: `Itens - Operador - Condomínio` (ex.: *Kit de 10 almofadas, Lousa Infantil e Expositor - Sueli - Glória Tinoco*)
   - Corpo: fotos dos itens + "Boa tarde, tudo bem? Segue boleto para pagamento dos itens acima."
   - Boleto(s) em anexo
4. **Verifica a caixa de entrada a cada 5 minutos** e mostra as respostas da administradora na aba *Acompanhamento*.

Os condomínios atendidos por **WhatsApp** (empresa Cedro) ficam registrados do mesmo jeito. O app abre a conversa no WhatsApp com a mensagem pronta, e o boleto é anexado manualmente.

## Como instalar (Windows)

1. Instale o **Node.js 20 ou mais novo**: https://nodejs.org (versão LTS).
2. Crie uma **senha de app** do Gmail na conta que envia os boletos (sindicoprime1@gmail.com):
   - Ative a verificação em duas etapas da conta.
   - Acesse https://myaccount.google.com/apppasswords, crie uma senha chamada "Cedro Pagamentos" e copie os 16 caracteres.
   - No Gmail, ative o IMAP em *Configurações → Encaminhamento e POP/IMAP*, para o app conseguir ler as respostas.
3. Dê dois cliques em **`iniciar.bat`**. Na primeira vez, ele instala tudo e abre o arquivo `.env`. Preencha:
   ```
   EMAIL_USUARIO=sindicoprime1@gmail.com
   EMAIL_SENHA_APP=abcdefghijklmnop
   EMAIL_NOME=Cedro Pagamentos
   EMAIL_CC=financeiro@suaempresa.com.br
   ```
   Salve, feche o Bloco de Notas e rode o `iniciar.bat` de novo.
4. O navegador abre em http://localhost:3002.

## Fixar na tela inicial

Dê dois cliques em **`criar-atalho.bat`**. Ele cria o atalho **Cedro Pagamentos**, com o ícone da Cedro, na Área de Trabalho e no Menu Iniciar.
Depois abra o Menu Iniciar, procure "Cedro Pagamentos", clique com o botão direito e escolha **Fixar em Iniciar** ou **Fixar na barra de tarefas**.

## Telas

- **Nova compra**: arraste as fotos e o boleto, confira o resumo e clique em *Enviar para a ADM*.
- **Acompanhamento**: todas as compras, com status (*Aguardando resposta*, *Respondido*, *Pago*, *WhatsApp*, *Erro*), as respostas da ADM e o botão *Marcar como pago*.
- **Condomínios**: edite e-mails, canal e responsável, ou cole a planilha do Excel inteira em *Importar planilha* para atualizar tudo de uma vez.

## Onde ficam os dados

Tudo fica no seu computador, dentro da pasta do app:

- `data/db.json`: o banco de dados (cadastro de condomínios, histórico de compras e respostas). É criado sozinho na primeira vez a partir da planilha `data/seed.tsv`.
- `uploads/`: fotos e boletos de cada compra.

Para ver o histórico no Excel, use o botão **Baixar planilha (Excel)** na aba Acompanhamento.
Faça backup das pastas `data` e `uploads` (por exemplo, copiando para o Google Drive ou um pen drive).
