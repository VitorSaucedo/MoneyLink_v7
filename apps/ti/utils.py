from django.utils import timezone
from django.http import JsonResponse
from django.shortcuts import get_object_or_404

from .models import (
    Periferico, 
    Computador, 
    PosicaoAtendimento, 
    AtribuicaoPerifericoPA,
    AtribuicaoComputadorPA
)

def atribuir_item_pa(item, pa, model_atribuicao, **kwargs):
    """
    Função genérica para atribuir um item (periférico ou computador) a uma PA.
    
    Args:
        item: Objeto do item a ser atribuído (Periferico ou Computador)
        pa: Objeto da posição de atendimento
        model_atribuicao: Modelo de atribuição (AtribuicaoPerifericoPA ou AtribuicaoComputadorPA)
        **kwargs: Argumentos adicionais específicos para o modelo de atribuição
    
    Returns:
        Tupla com (atribuicao, True se foi criada ou False se foi atualizada)
    """
    # Definir valores padrão para a atribuição
    defaults = {
        'ativo': True,
        'data_atribuicao': timezone.now(),
        'data_remocao': None
    }
    
    # Adicionar argumentos específicos se existirem
    if kwargs:
        defaults.update(kwargs)
    
    # Filtro para encontrar atribuição existente
    filtro = {
        'posicao_atendimento': pa
    }
    
    # Determinar o tipo de item e adicionar ao filtro
    if isinstance(item, Periferico):
        filtro['periferico'] = item
    elif isinstance(item, Computador):
        filtro['computador'] = item
    
    # Atualizar ou criar a atribuição
    atribuicao, criada = model_atribuicao.objects.update_or_create(
        **filtro,
        defaults=defaults
    )
    
    # Atualizar o status do item para 'em_uso'
    item.status = 'em_uso'
    item.save()
    
    return atribuicao, criada

def desatribuir_item_pa(atribuicao):
    """
    Função genérica para desatribuir um item (periférico ou computador) de uma PA.
    
    Args:
        atribuicao: Objeto de atribuição (AtribuicaoPerifericoPA ou AtribuicaoComputadorPA)
    
    Returns:
        Objeto de atribuição atualizado
    """
    # Marcar a atribuição como inativa
    atribuicao.ativo = False
    atribuicao.data_remocao = timezone.now()
    atribuicao.save()
    
    # Obter o item correto com base no tipo de atribuição
    if hasattr(atribuicao, 'periferico'):
        item = atribuicao.periferico
        # Verificar se o item não está ativo em nenhuma outra PA
        outras_atribuicoes_ativas = atribuicao.__class__.objects.filter(
            periferico=item,
            ativo=True
        ).exclude(pk=atribuicao.pk).exists()
    elif hasattr(atribuicao, 'computador'):
        item = atribuicao.computador
        # Verificar se o item não está ativo em nenhuma outra PA
        outras_atribuicoes_ativas = atribuicao.__class__.objects.filter(
            computador=item,
            ativo=True
        ).exclude(pk=atribuicao.pk).exists()
    else:
        return atribuicao  # Tipo de atribuição não reconhecido
    
    # Se não houver outras atribuições ativas, marcar como disponível
    if not outras_atribuicoes_ativas:
        item.status = 'disponivel'
        item.save()
    
    return atribuicao

def verificar_disponibilidade_periferico(periferico_id, pa_id=None):
    """
    Verifica se um periférico está disponível para atribuição.
    
    Args:
        periferico_id: ID do periférico
        pa_id: ID da PA atual (opcional, para ignorar atribuições a esta PA)
    
    Returns:
        Tupla (disponivel, mensagem_erro)
    """
    try:
        periferico = get_object_or_404(Periferico, pk=periferico_id)
        
        # Verificar se o periférico já está atribuído a outra PA
        query = AtribuicaoPerifericoPA.objects.filter(periferico=periferico, ativo=True)
        if pa_id:
            query = query.exclude(posicao_atendimento_id=pa_id)
        
        atribuicao_existente = query.first()
        
        if atribuicao_existente:
            pa = atribuicao_existente.posicao_atendimento
            mensagem = f"Este periférico já está atribuído à PA {pa.numero} "
            if pa.ilha:
                mensagem += f"na Ilha {pa.ilha.nome} "
            if pa.sala:
                mensagem += f"da Sala {pa.sala.nome}"
            return False, mensagem
        
        # Verificar se o periférico está disponível pelo status
        if periferico.status not in ['disponivel', 'em_uso']:
            return False, f"Periférico não está disponível. Status atual: {periferico.get_status_display()}"
        
        return True, ""
        
    except Periferico.DoesNotExist:
        return False, "Periférico não encontrado."

def verificar_disponibilidade_computador(computador_id, pa_id=None):
    """
    Verifica se um computador está disponível para atribuição.
    
    Args:
        computador_id: ID do computador
        pa_id: ID da PA atual (opcional, para ignorar atribuições a esta PA)
    
    Returns:
        Tupla (disponivel, mensagem_erro)
    """
    try:
        computador = get_object_or_404(Computador, pk=computador_id)
        
        # Verificar se o computador já está atribuído a outra PA
        query = AtribuicaoComputadorPA.objects.filter(computador=computador, ativo=True)
        if pa_id:
            query = query.exclude(posicao_atendimento_id=pa_id)
        
        atribuicao_existente = query.first()
        
        if atribuicao_existente:
            pa = atribuicao_existente.posicao_atendimento
            mensagem = f"Este computador já está atribuído à PA {pa.numero} "
            if pa.ilha:
                mensagem += f"na Ilha {pa.ilha.nome} "
            if pa.sala:
                mensagem += f"da Sala {pa.sala.nome}"
            return False, mensagem
        
        # Verificar se o computador está disponível pelo status
        if computador.status not in ['disponivel', 'em_uso']:
            return False, f"Computador não está disponível. Status atual: {computador.get_status_display()}"
        
        return True, ""
        
    except Computador.DoesNotExist:
        return False, "Computador não encontrado."

def gerar_resposta_api(success, message=None, error=None, data=None, status=200):
    """
    Gera uma resposta padronizada para APIs.
    
    Args:
        success: Booleano indicando se a operação foi bem-sucedida
        message: Mensagem de sucesso (opcional)
        error: Mensagem de erro (opcional)
        data: Dados adicionais (opcional)
        status: Código de status HTTP (padrão: 200)
    
    Returns:
        JsonResponse com os dados formatados
    """
    response = {'success': success}
    
    if message:
        response['message'] = message
    
    if error:
        response['error'] = error
    
    if data:
        response.update(data)
    
    return JsonResponse(response, status=status)

def listar_itens_atribuidos_pa(pa, tipo_item):
    """
    Lista os itens (periféricos ou computadores) atribuídos a uma PA.
    
    Args:
        pa: Objeto da posição de atendimento
        tipo_item: String indicando o tipo de item ('periferico' ou 'computador')
    
    Returns:
        Lista de dicionários com informações dos itens
    """
    itens = []
    
    if tipo_item == 'periferico':
        atribuicoes = AtribuicaoPerifericoPA.objects.filter(
            posicao_atendimento=pa, 
            ativo=True
        ).select_related('periferico', 'periferico__tipo')
        
        for atr in atribuicoes:
            itens.append({
                'id': atr.periferico.id,
                'tipo': atr.periferico.tipo.nome,
                'marca': atr.periferico.marca,
                'modelo': atr.periferico.modelo or '',
            })
    
    elif tipo_item == 'computador':
        atribuicoes = AtribuicaoComputadorPA.objects.filter(
            posicao_atendimento=pa, 
            ativo=True
        ).select_related('computador')
        
        for atr in atribuicoes:
            itens.append({
                'id': atr.computador.id,
                'marca': atr.computador.marca,
            })
    
    return itens
