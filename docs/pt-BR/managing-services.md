# Gerenciando seus serviços

Tudo acontece no **painel**. Cada serviço tem um cartão que mostra seu status e
as ações que você pode realizar.

## Cartões de serviço

- Um **ponto de status** colorido informa o estado num relance:
  - **verde — Em execução**
  - **cinza — Parado**
  - **âmbar — Configuração necessária** ou **Requer atenção**
- **Abrir** abre o serviço **dentro do Ensembler como uma aba** — sem navegador
  separado e sem aviso de "Não seguro". Uma barra no topo permite alternar entre
  o **Painel** e quaisquer serviços abertos, e fechar uma aba com o seu **✕**.
  Ela também tem um botão de **recarregar** e um de **abrir no navegador** para o
  serviço atual.
- Uma pequena **versão** aparece em cada cartão em execução. Um **🔒 cadeado**
  significa que o serviço está fixado em uma versão específica; o marcador **↻**
  significa que ele acompanha a versão mais recente. Ele fica âmbar quando há uma
  atualização disponível.
- O **menu ⋯** contém o resto: **Abrir no navegador**, **Iniciar / Parar**,
  **Reiniciar**, **Ver logs**, **Verificar atualizações** e **Configurar**.

Enquanto um serviço está iniciando ou parando, o status mostra um breve
"Iniciando…/Parando…" para que você saiba que algo está acontecendo.

## Adicionando e removendo serviços

- **Adicionar serviço** (no topo da seção Serviços) permite adicionar qualquer
  coisa que você não tenha escolhido durante a configuração, agrupado por
  categoria para facilitar a busca.
- Para remover um serviço, abra seu **menu ⋯ → Configurar**.

Tanto aqui quanto no painel, os serviços são agrupados por categoria (servidores
de mídia, gerenciamento de mídia, clientes de download, e assim por diante).

## Mantendo os serviços atualizados

- O Ensembler verifica discretamente em segundo plano, então as atualizações
  disponíveis aparecem por conta própria. Você também pode clicar em
  **Verificar atualizações** (no topo da seção Serviços) para verificar tudo
  agora, ou verificar um único serviço pelo seu **menu ⋯ → Verificar
  atualizações** (o resultado aparece no cartão).
- Quando há atualizações disponíveis, o cabeçalho de Serviços mostra quantas, e
  um botão **Atualizar tudo** as aplica de uma só vez. Para atualizar apenas um,
  clique em **Atualização disponível — atualizar agora** em seu cartão. Suas
  configurações são preservadas.
- **Fixe uma versão.** Por padrão, cada serviço acompanha a versão mais recente.
  Para manter um serviço em uma versão específica, abra **menu ⋯ → Configurar** e
  escolha na lista suspensa **Versão**. Serviços fixados exibem um 🔒 e deixam de
  oferecer atualizações.
- **Atualizações automáticas.** Ative **Configurações → Geral → Instalar
  atualizações automaticamente** para que o Ensembler aplique as atualizações
  disponíveis em segundo plano. Isso vem desativado por padrão, então você
  permanece no controle.

## Configurações

Abra **Configurações** (canto superior direito) para opções de todo o aplicativo:

- **Aparência** — tema (Clara, Escura ou Sistema) e idioma.
- **Geral** — manter o Ensembler na barra de menus / bandeja do sistema quando
  você fecha a janela (ativado por padrão; seus serviços continuam em execução de
  qualquer forma — use **Sair** no menu da bandeja para encerrar completamente),
  instalar atualizações de serviços automaticamente (desativado por padrão) e o
  seu fuso horário.
- **Avançado** — detalhes técnicos que você normalmente não precisará:
  diagnósticos (se o Docker está em execução, quantos serviços estão ativos),
  espaço livre em disco e memória, e os IDs de usuário/grupo usados para
  permissões de arquivos.
- **Redefinir → Redefinir tudo** — para e remove todos os serviços e suas
  configurações, retornando o Ensembler a uma instalação nova. **Seus arquivos
  de mídia nunca são tocados** — apenas os serviços e sua configuração são
  removidos.

## Onde ficam suas configurações

O Ensembler armazena sua configuração em uma pasta oculta por usuário (gerenciada
para você — você não deve precisar editá-la):

- **macOS:** `~/Library/Application Support/Ensembler`
- **Windows:** `%APPDATA%\Ensembler`
- **Linux:** `~/.config/Ensembler`

Seus **arquivos de mídia** (TV, filmes, downloads) ficam onde quer que você tenha
escolhido durante a configuração e são separados disso.

## Diagnósticos

O status técnico — se o Docker está em execução, quantos serviços estão ativos e
quanto de disco e memória estão livres — fica em **Configurações → Avançado**.
Normalmente você não precisará dele, mas ele é útil na solução de problemas.
