# Gerar as artes direto do Google Sheets

O script [`GerarImagens.gs`](GerarImagens.gs) lê as abas de briefing, pede cada
imagem ao Gemini, salva o PNG no seu Google Drive e preenche **Link da Imagem**.

## Uma vez só

1. **Chave do Gemini:** em <https://aistudio.google.com/apikey>, crie uma chave.
   Geração de imagem pela API é paga: cerca de US$ 0,04 por imagem
   (as 136 figurinhas ficam em torno de US$ 5–6). Ative o faturamento no projeto da chave.
2. **Planilha:** no Google Sheets, *Arquivo → Importar → Fazer upload* →
   [`../Briefing_Arte_T1.xlsx`](../Briefing_Arte_T1.xlsx) → *Substituir planilha*.
   Ficam 5 abas: Jogadores_Tecnicos_Lendas, Escudos, Estadios, Mascotes, Momentos.
3. **Script:** na planilha, *Extensões → Apps Script*. Apague o que estiver no
   editor, cole todo o conteúdo de `GerarImagens.gs` e clique em 💾 Salvar.
4. Volte à planilha e recarregue a página. Aparece o menu **🎨 Artes**.
5. **🎨 Artes → 1. Configurar chave do Gemini** e cole a chave. Na primeira vez o
   Google pede autorização (planilha, Drive e acesso externo): *Avançado → Acessar*.

## Usando

- **Teste uma linha primeiro:** clique numa linha e use
  *🎨 Artes → Gerar só a linha selecionada*. Confira a imagem; ajuste o texto da
  coluna "O que o desenho deve trazer" se quiser e gere de novo (substitui o arquivo).
- **Gerar tudo:** *Gerar as que faltam* roda por até 5 minutos (cerca de 15–25 imagens)
  e continua de onde parou na próxima vez. Ou *Ligar geração automática*: roda a cada
  10 minutos e se desliga sozinha quando acabar.
- Para refazer uma imagem: apague o link da linha (ou use "linha selecionada").
- Se uma linha falhar, a célula do link ganha uma **nota** com o motivo.

As imagens ficam em **Meu Drive → Craques da Várzea - Artes → (uma pasta por aba)**,
com o nome do código (`TUB-04.png`) e compartilhadas como "qualquer pessoa com o link
pode ver", para poderem ser baixadas e colocadas no app.

Se o Google lançar um modelo de imagem melhor, troque a lista `MODELOS` no topo do script.

---

# Alternativa: Cloudflare Workers AI (grátis até ~150 imagens/dia)

[`GerarImagensCloudflare.gs`](GerarImagensCloudflare.gs) funciona igual, mas usa o
FLUX.1 schnell da Cloudflare. Cada texto é traduzido para inglês antes (o FLUX entende
melhor) pelo modelo de tradução da própria Cloudflare.

**Use um script ou o outro**, não os dois no mesmo projeto (têm as mesmas funções).

1. Crie uma conta grátis em <https://dash.cloudflare.com>.
2. No painel: **AI → Workers AI → Use REST API**. Copie o **Account ID** e clique em
   **Create a Workers AI API Token** (copie o token; ele só aparece uma vez).
3. Importe a planilha e cole o script como nos passos 2–4 acima.
4. **🎨 Artes → 1. Configurar conta da Cloudflare**: cole o Account ID e depois o token.

Diferenças em relação ao Gemini:

- **Custo:** o plano grátis dá 10.000 "neurons" por dia; cada imagem gasta algo
  perto de 60, então dá para fazer as 136 figurinhas em um ou dois dias sem pagar.
- **Formato:** sai sempre quadrada (1024×1024, JPG). Estádios e momentos ficam
  quadrados; o app corta as bordas na hora de mostrar.
- **Qualidade:** o FLUX schnell é rápido, mas costuma seguir menos os detalhes do
  texto que o Gemini. Gere algumas linhas de teste e compare.
- Pasta no Drive: **Craques da Várzea - Artes (Cloudflare)**.
