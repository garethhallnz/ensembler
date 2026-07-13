# Primeiros passos

## O que você precisa

O Ensembler executa seus serviços no Docker, então você precisa de um **runtime
de contêineres** instalado e em execução — algo que forneça os comandos `docker`
e `docker compose`.

- **Recomendado (mais fácil):**
  [Docker Desktop](https://www.docker.com/products/docker-desktop/) — uma
  instalação com um clique para macOS, Windows e Linux. Se você não o tiver, o
  Ensembler o direciona para ele na primeira execução.
- **Já usa outra coisa?** Qualquer runtime compatível com Docker funciona igual
  de bem — por exemplo **OrbStack** (macOS), **Podman**, **Rancher Desktop**,
  **colima** ou **Docker Engine** no Linux. Desde que `docker` e `docker compose`
  funcionem, o Ensembler os usará.

Você **não** precisa de Node.js, de um terminal nem de quaisquer ferramentas de
desenvolvedor para usar o aplicativo.

## Primeira execução

Quando você abre o Ensembler pela primeira vez, ele verifica se o Docker está em
execução. Se o Docker não estiver instalado ou iniciado, você verá instruções
para resolver isso — inicie o Docker Desktop, aguarde até que ele informe que
está em execução, e o Ensembler continuará.

## O assistente de configuração

### 1. Escolha seus serviços
Serviços recomendados vêm pré-selecionados para um centro de mídia completo.
Categorias rotuladas como **"escolha um"** (servidor de mídia, cliente de
download, gerenciador de indexadores, solicitações) permitem escolher uma única
opção; "gerenciamento de mídia" permite escolher vários.

### 2. Defina suas pastas
Diga ao Ensembler onde ficam suas **séries de TV**, **filmes** e **downloads**.
Essas são suas próprias pastas — escolha locais com espaço suficiente para sua
biblioteca. As portas são verificadas automaticamente e, se uma porta padrão já
estiver em uso, o Ensembler escolhe discretamente uma livre para você.

### 3. Aplique
O Ensembler gera a configuração, inicia seus serviços e os conecta entre si.
Você verá cada etapa sendo concluída.

## Concluindo a configuração

Algumas etapas só podem ser feitas por você, e o painel as solicitará em uma
lista **"Concluir a configuração"**:

- **Adicionar um indexador no Prowlarr** — para que o Sonarr e o Radarr possam
  buscar conteúdo. Você escolhe suas próprias fontes; o Ensembler nunca as
  escolhe por você.
- **Entrar no Plex** — o Ensembler então cria suas bibliotecas de TV e Filmes
  automaticamente. (O Jellyfin não exige login — ele é configurado inteiramente
  para você.)
- **Finalizar o Overseerr** — ele entra com o Plex e descobre seus outros
  serviços.

Cada solicitação tem um link **Abrir** que leva você diretamente ao lugar certo.

Quando essas etapas estiverem concluídas, tudo estará funcionando.
