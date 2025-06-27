# Documentação dos Módulos JavaScript - Sistema TI

## Visão Geral

Este diretório contém os módulos JavaScript refatorados para o sistema de administração de TI. A refatoração foi realizada para eliminar duplicação de código e centralizar funcionalidades comuns.

## Estrutura dos Módulos

### Módulos Centralizados

#### `admin_utils.js` - Utilitários Centralizados
**Responsabilidade**: Funções utilitárias compartilhadas entre todos os módulos

**Funções Exportadas**:
- **Carregamento de Dados**:
  - `carregarIlhasPorSala(salaId, targetSelect)` - Carrega ilhas baseadas na sala selecionada
  - `carregarPAsPorIlha(ilhaId, targetSelect, lojaId)` - Carrega PAs baseadas na ilha selecionada
  - `carregarSalasPorLoja(lojaId, targetSelect)` - Carrega salas baseadas na loja selecionada

- **Validações**:
  - `verificarRamalExistente(ramal, funcionarioId)` - Verifica se um ramal já existe
  - `validateAdminRamalForm(formData)` - Valida formulários de ramal
  - `validateAdminComputadorForm(formData)` - Valida formulários de computador

- **Interface**:
  - `setupConditionalFields()` - Configura campos condicionais para status de computador
  - `toggleSubmitButton(isValid)` - Habilita/desabilita botões de submit

#### `admin_notifications.js` - Sistema de Notificações
**Responsabilidade**: Gerenciamento centralizado de notificações e mensagens

**Funções Exportadas**:
- `showAdminNotification(type, message, duration)` - Exibe notificações
- `showSuccessMessage(message)` - Exibe mensagens de sucesso
- `showErrorMessage(message)` - Exibe mensagens de erro

#### `admin_dropdown_updates.js` - Atualizações de Dropdowns
**Responsabilidade**: Gerenciamento de atualizações dinâmicas de dropdowns

**Funções Exportadas**:
- `updateAdminSalasDropdown(lojaId)` - Atualiza dropdown de salas
- `updateAdminIlhasDropdown(salaId)` - Atualiza dropdown de ilhas
- `updateAdminPAsDropdown(ilhaId)` - Atualiza dropdown de PAs
- `carregarPAsPorIlha(ilhaId, lojaId)` - Carrega PAs por ilha
- `obterInfoIlha(ilhaId)` - Obtém informações detalhadas da ilha
- `atualizarQuantidadePAs(ilhaId)` - Atualiza quantidade máxima de PAs

### Módulos Específicos

#### `admin_init.js` - Inicialização
**Responsabilidade**: Inicialização de formulários e configurações específicas

**Dependências**:
- `admin_utils.js` (para validações e campos condicionais)
- `admin_notifications.js` (para mensagens)

#### `admin_custom.js` - Customizações
**Responsabilidade**: Lógicas específicas e customizações

**Dependências**:
- `admin_utils.js` (para carregamento de dados)
- `admin_notifications.js` (para notificações)

#### `admin_data_loader.js` - Carregamento de Dados
**Responsabilidade**: Funções específicas de carregamento de dados

**Dependências**:
- `admin_utils.js` (para funções centralizadas de carregamento)

#### `admin.js` - Funcionalidades Principais
**Responsabilidade**: Lógicas principais do sistema de administração

**Dependências**:
- `admin_utils.js` (para todas as funções utilitárias)
- `admin_notifications.js` (para notificações)
- `admin_dropdown_updates.js` (para atualizações de dropdowns)

## Padrão de Implementação

### Fallback para Compatibilidade
Todos os módulos implementam um padrão de fallback para garantir compatibilidade:

```javascript
if (window.TIAdminUtils && window.TIAdminUtils.funcaoCentralizada) {
    window.TIAdminUtils.funcaoCentralizada(parametros);
} else {
    // Implementação local como fallback
    implementacaoLocal(parametros);
}
```

### Exportação Global
Todas as funções são exportadas através de objetos globais:

- `window.TIAdminUtils` - Utilitários centralizados
- `window.TIAdminNotifications` - Sistema de notificações
- `window.TIAdminDropdowns` - Atualizações de dropdowns

## Benefícios da Refatoração

1. **Eliminação de Duplicação**: Funções comuns centralizadas em um único local
2. **Manutenibilidade**: Mudanças precisam ser feitas apenas em um lugar
3. **Consistência**: Comportamento uniforme em todo o sistema
4. **Reutilização**: Funções podem ser facilmente reutilizadas
5. **Testabilidade**: Funções centralizadas são mais fáceis de testar

## Ordem de Carregamento Recomendada

Para garantir que as dependências sejam carregadas corretamente:

1. `admin_utils.js` (base para todos os outros)
2. `admin_notifications.js` (sistema de notificações)
3. `admin_dropdown_updates.js` (atualizações de interface)
4. `admin_data_loader.js` (carregamento específico)
5. `admin_init.js` (inicializações)
6. `admin_custom.js` (customizações)
7. `admin.js` (funcionalidades principais)

## Migração e Compatibilidade

A refatoração foi implementada de forma a manter compatibilidade com código existente através de:

- Fallbacks locais quando funções centralizadas não estão disponíveis
- Manutenção de interfaces de função existentes
- Verificações de existência antes de usar funções centralizadas

Esta abordagem permite uma migração gradual e reduz o risco de quebras no sistema existente.