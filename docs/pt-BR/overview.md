# O que é o Ensembler?

O Ensembler configura e executa um **centro de mídia doméstico** para você — a
popular pilha "*arr" (Sonarr, Radarr, Prowlarr e companhia) mais um servidor de
mídia como o Plex ou o Jellyfin — sem que você precise conhecer Docker, YAML ou
a linha de comando.

Você escolhe os serviços que deseja, o Ensembler os instala, os inicia, os
conecta entre si e lhe oferece um único painel para gerenciar tudo.

## Como funciona

Nos bastidores, cada serviço roda em seu próprio **contêiner Docker**. O
Ensembler gera a configuração do Docker, inicia os contêineres e os conecta uns
aos outros para que funcionem como um só sistema. Você nunca precisa mexer em um
arquivo de configuração.

O percurso típico é:

1. **Assistente de configuração** — escolha seus serviços, aponte o Ensembler
   para suas pastas de mídia e clique em **Aplicar**. As portas são verificadas
   para você, e portas livres são escolhidas automaticamente caso uma padrão
   esteja ocupada.
2. **Conexão automática** — Sonarr e Radarr recebem seu cliente de download e
   suas pastas, o Prowlarr se conecta a eles, o Plex recebe notificações de
   importação assim que você faz login, e assim por diante. Você acompanha cada
   etapa sendo concluída.
3. **Painel** — a partir daí você gerencia tudo em um só lugar: abrir um serviço,
   iniciá-lo/pará-lo, verificar atualizações ou adicionar mais serviços.

## O que os serviços fazem

| Serviço | Função |
|---|---|
| **Sonarr** | Gerencia suas séries de TV |
| **Radarr** | Gerencia seus filmes |
| **Bazarr** | Gerencia legendas para o Sonarr/Radarr |
| **Plex / Jellyfin / Emby** | Transmitem sua mídia para seus dispositivos |
| **Transmission / Deluge** | Clientes de download |
| **Prowlarr / Jackett** | Gerenciam onde seus serviços buscam conteúdo |
| **Overseerr** | Solicita e descobre mídia |

## O que o Ensembler faz — e o que não faz

O Ensembler **conecta seus serviços entre si**. Ele **não** seleciona, solicita
nem baixa qualquer conteúdo, e **não** configura indexadores ou trackers para
você. Você escolhe suas próprias fontes e é responsável por como as utiliza.
