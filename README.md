# AACE: Assistente de Agendamento de Consultas e Exames

Marcar consulta ou exame pelo plano de saúde costuma começar com um PDF de dezenas de páginas: o guia da rede credenciada. Dali em diante é copiar telefone por telefone, procurar endereço no mapa, mandar a mesma mensagem para dez clínicas e tentar lembrar quem respondeu.

O AACE faz essa parte chata. Você envia o PDF do guia e recebe uma planilha com todos os prestadores, em que cada telefone já abre o WhatsApp com a mensagem de agendamento pronta e cada endereço abre a rota no mapa a partir da sua casa.

**Use agora:** https://pednba.github.io/aaec/

Não precisa instalar nada nem criar conta no AACE. É uma página só, que roda no seu navegador.

## O que ele faz

1. **Lê o guia médico em PDF** de qualquer plano de saúde (consultas ou exames) e extrai, com IA, cada prestador: estabelecimento, bairro, cidade, endereço, médicos e até três telefones. Identifica sozinho o plano, a especialidade e se o guia é de consulta ou de exame.
2. **Monta a mensagem de WhatsApp** a partir dos dados de quem vai ser atendido (nome, relação, idade, plano). Você pode editar à mão ou pedir para a IA reescrever com o motivo da consulta e algum contexto.
3. **Mostra uma prévia** dos dados extraídos para você conferir antes de gerar a planilha.
4. **Gera a planilha `.xlsx`** com:
   - telefone clicável que abre o WhatsApp com a mensagem já escrita (números 0800 ficam sem link, porque não têm WhatsApp);
   - endereço clicável que abre o Google Maps;
   - uma coluna de rota para cada endereço de partida cadastrado (sua casa, a casa dos seus pais, o trabalho etc.): o link abre o Google Maps com o caminho de carro saindo desse endereço até o consultório ou a clínica;
   - coluna "Status do Contato" para acompanhar quem respondeu.
5. **Guarda perfis** (ex.: "Mãe", "Eu", "Filho") e quantos endereços de partida você quiser no seu navegador, para não digitar tudo de novo. Os endereços valem para todos os perfis. Dá para baixar um backup e importar em outro computador.

A planilha abre no Excel, no Google Planilhas e no LibreOffice.

## Chave da API

A leitura do PDF é feita pelo Claude, modelo de IA da Anthropic. O AACE não tem servidor nem cobra nada: cada pessoa usa a própria chave da API da Anthropic, e o custo de uso cai direto na conta dela.

Para conseguir uma chave:

1. Crie uma conta em https://platform.claude.com.
2. Adicione créditos em *Billing* (a API é paga por uso, separada da assinatura do app Claude).
3. Em *API Keys*, crie uma chave. Ela começa com `sk-ant-`.
4. Cole a chave na barra escura no topo do AACE. Ela fica salva só no seu navegador.

Na mesma barra você escolhe o modelo:

| Modelo | Quando usar |
|---|---|
| Claude Opus 5.5 (padrão) | Mais preciso. Melhor para guias longos ou com layout confuso |
| Claude Sonnet 5.5 | Equilíbrio entre precisão e custo |
| Claude Haiku 5.5 | Mais barato. Funciona bem com guias curtos e bem formatados |

O custo depende do tamanho do guia. Um guia de poucas dezenas de páginas costuma custar centavos de dólar no Haiku e menos de um dólar no Opus. Os preços atualizados estão em https://claude.com/pricing#api.

**Dica de segurança:** crie uma chave só para o AACE e defina um limite de gasto mensal na sua conta da Anthropic. Se algo der errado, basta apagar essa chave.

## Privacidade

- O PDF e os dados digitados saem do seu navegador direto para a API da Anthropic. Não existe nenhum servidor do AACE no caminho, e este projeto não coleta nada.
- Perfis, endereços, a pasta e a chave ficam no `localStorage` do navegador em que você usou. Quem usar o mesmo navegador, no mesmo usuário do computador, consegue vê-los. O botão "Apagar tudo deste navegador" remove perfis e endereços; o botão "Limpar" ao lado da chave remove a chave.
- Guias médicos, nomes e motivos de consulta são dados de saúde. Use o AACE num computador de confiança.
- A política de uso de dados da API da Anthropic está em https://www.anthropic.com/legal/privacy.

## Limitações

- A IA pode errar na leitura do PDF, principalmente em PDFs escaneados (imagem). Confira a prévia antes de ligar ou mandar mensagem.
- O limite é de 30 MB por PDF. Guias muito grandes podem passar do tamanho de resposta da IA. Nesse caso o AACE avisa e você divide o PDF em partes.
- Feito para planos de saúde do Brasil: os links de WhatsApp usam o código do país 55.

## Rodar no seu computador

É um arquivo HTML só. Baixe o repositório e abra `index.html` no navegador. Precisa de internet para chamar a API e carregar a biblioteca de planilhas ([SheetJS](https://sheetjs.com)).

Para publicar a sua própria cópia, faça um fork e ative o GitHub Pages em *Settings → Pages → Source: GitHub Actions*. O workflow `.github/workflows/pages.yml` publica a página a cada push na `main`.

## Testes

O teste de fumaça percorre os cinco passos com a API simulada (não usa chave nem gasta crédito) e confere a planilha gerada:

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm test
```

O mesmo teste roda no GitHub Actions a cada pull request.

## Contribuir

Sugestões e correções são bem-vindas. Abra uma issue descrevendo o problema (sem anexar guias com dados pessoais) ou envie um pull request. Se mudar o comportamento da página, atualize `tests/smoke.mjs` junto.

## Licença

[MIT](LICENSE). Pode usar, copiar, modificar e redistribuir, inclusive comercialmente, desde que mantenha o aviso de licença. O software é fornecido sem garantia.
