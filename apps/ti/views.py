from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.db.models import Count, Q, Prefetch, Sum
from django.views.decorators.http import require_POST, require_GET
from django.core.paginator import Paginator
from django.utils import timezone
import json

# Imports locais
from .utils import (
    atribuir_item_pa, 
    desatribuir_item_pa, 
    verificar_disponibilidade_periferico, 
    verificar_disponibilidade_computador, 
    gerar_resposta_api, 
    listar_itens_atribuidos_pa
)
from .pagination_utils import paginate_queryset, get_pagination_data
from .models import (
    TipoPeriferico, 
    Periferico, 
    PosicaoAtendimento, 
    AtribuicaoFuncionarioPA, 
    AtribuicaoPerifericoPA,
    Sala,
    Ilha,
    Computador,
    AtribuicaoComputadorPA,
    Monitor,
    AtribuicaoMonitorPA,
    Chip,
    Email,
    Storm,
    Sistema,
    CoordenadorSala,
    Ramal
)
from .forms import (
    TipoPerifericoForm,
    PerifericoForm,
    PosicaoAtendimentoForm,
    AtribuicaoFuncionarioPAForm,
    AtribuicaoPerifericoPAForm,
    SalaForm,
    IlhaForm,
    ComputadorForm,
    AtribuicaoComputadorPAForm,
    MonitorForm,
    AtribuicaoMonitorPAForm,
    ChipForm,
    EmailForm,
    StormForm,
    SistemaForm,
    CoordenadorSalaForm
)
from apps.funcionarios.models import Funcionario, Empresa, Setor, Loja

# Create your views here.

# ============================================================================
# CONSTANTES E CONFIGURAÇÕES
# ============================================================================

# Status válidos para diferentes entidades
STATUS_CHOICES = {
    'periferico': ['disponivel', 'em_uso', 'manutencao', 'descartado'],
    'computador': ['disponivel', 'em_uso', 'manutencao', 'descartado'],
    'monitor': ['disponivel', 'em_uso', 'manutencao', 'descartado'],
    'pa': ['ativo', 'inativo', 'manutencao'],
    'email': ['ativo', 'inativo', 'suspenso'],
    'chip': ['ativo', 'inativo', 'suspenso'],
    'storm': ['ativo', 'inativo', 'manutencao']
}

# Tipos de periféricos comuns
TIPOS_PERIFERICOS_COMUNS = ['Mouse', 'Teclado', 'Monitor', 'Fone', 'Mousepad']

# Configurações de paginação
PAGINATION_CONFIG = {
    'default_per_page': 20,
    'max_per_page': 100
}

# ============================================================================
# FUNÇÕES AUXILIARES PARA APIS
# ============================================================================

def extract_json_data(request):
    """
    Extrai e valida dados JSON da requisição.
    
    Args:
        request: HttpRequest
    
    Returns:
        dict: {
            'success': bool,
            'data': dict,
            'error': str
        }
    """
    try:
        data = json.loads(request.body)
        return {
            'success': True,
            'data': data,
            'error': None
        }
    except json.JSONDecodeError:
        return {
            'success': False,
            'data': None,
            'error': 'Dados JSON inválidos'
        }
    except Exception as e:
        return {
            'success': False,
            'data': None,
            'error': f'Erro ao processar dados: {str(e)}'
        }

def validate_required_fields(data, required_fields):
    """
    Valida se os campos obrigatórios estão presentes nos dados.
    
    Args:
        data: dict com os dados a serem validados
        required_fields: dict {campo: label} dos campos obrigatórios
    
    Returns:
        dict: {
            'success': bool,
            'missing_fields': list,
            'error': str
        }
    """
    missing_fields = []
    
    for field_key, field_label in required_fields.items():
        if field_key not in data or not data[field_key]:
            missing_fields.append(field_label)
    
    if missing_fields:
        return {
            'success': False,
            'missing_fields': missing_fields,
            'error': f"Campos obrigatórios não fornecidos: {', '.join(missing_fields)}"
        }
    
    return {
        'success': True,
        'missing_fields': [],
        'error': None
    }

def validate_status(status, entity_type):
    """
    Valida se o status é válido para o tipo de entidade.
    
    Args:
        status: str - status a ser validado
        entity_type: str - tipo da entidade (periferico, computador, etc.)
    
    Returns:
        dict: {
            'success': bool,
            'error': str
        }
    """
    valid_statuses = STATUS_CHOICES.get(entity_type, [])
    
    if status not in valid_statuses:
        return {
            'success': False,
            'error': f'Status inválido. Valores aceitos: {", ".join(valid_statuses)}'
        }
    
    return {
        'success': True,
        'error': None
    }

def extract_filter_params(request, allowed_filters):
    """
    Extrai parâmetros de filtro da requisição GET.
    
    Args:
        request: HttpRequest
        allowed_filters: list - lista de filtros permitidos
    
    Returns:
        dict: parâmetros de filtro extraídos
    """
    filters = {}
    
    for filter_name in allowed_filters:
        value = request.GET.get(filter_name)
        if value:
            filters[filter_name] = value
    
    return filters

def build_response_data(success, message=None, data=None, error=None, **kwargs):
    """
    Constrói dados de resposta padronizados para APIs.
    
    Args:
        success: bool - indica se a operação foi bem-sucedida
        message: str - mensagem de sucesso
        data: dict - dados da resposta
        error: str - mensagem de erro
        **kwargs: dados adicionais
    
    Returns:
        dict: dados formatados para resposta
    """
    response_data = {
        'success': success,
        'timestamp': timezone.now().isoformat()
    }
    
    if message:
        response_data['message'] = message
    
    if error:
        response_data['error'] = error
    
    if data:
        response_data['data'] = data
    
    # Adicionar dados extras
    response_data.update(kwargs)
    
    return response_data

def serialize_object_list(queryset, fields):
    """
    Serializa uma lista de objetos Django para dicionários.
    
    Args:
        queryset: QuerySet ou lista de objetos
        fields: list - campos a serem incluídos na serialização
    
    Returns:
        list: lista de dicionários com os dados serializados
    """
    serialized_data = []
    
    for obj in queryset:
        item_data = {}
        for field in fields:
            if hasattr(obj, field):
                value = getattr(obj, field)
                # Tratar campos relacionados
                if hasattr(value, 'id'):
                    item_data[field] = {
                        'id': value.id,
                        'nome': str(value)
                    }
                else:
                    item_data[field] = value
        serialized_data.append(item_data)
    
    return serialized_data

# ============================================================================
# VIEWS PRINCIPAIS
# ============================================================================

# View principal para Admin
@login_required
def admin(request):
    """
    Página de administração principal do módulo TI.
    
    Esta view renderiza o painel de administração que permite cadastrar:
    - Salas e ilhas (infraestrutura)
    - Posições de atendimento (PAs)
    - Computadores e periféricos
    - Tipos de periféricos
    - Ramais
    
    O contexto inclui formulários, listas de objetos para os selects,
    e contagens para possíveis painéis de estatísticas.
    Filtra dados baseado na loja selecionada.
    """
    # Obter todas as lojas ativas para o seletor
    lojas = Loja.objects.filter(status=True).order_by('nome')
    
    # Fixar filtro apenas para a loja SEDE
    try:
        loja_sede = Loja.objects.get(nome='SEDE')
        loja_selecionada = loja_sede.id
        loja_atual = loja_sede
    except Loja.DoesNotExist:
        # Se não encontrar SEDE, usar a primeira loja disponível
        primeira_loja = Loja.objects.filter(status=True).first()
        loja_selecionada = primeira_loja.id if primeira_loja else None
        loja_atual = primeira_loja
    
    # Aplicar filtro de loja nas consultas
    filtro_loja = {'loja_id': loja_selecionada} if loja_selecionada else {}
    
    # Formulários para criação de novos itens
    form_periferico = PerifericoForm()
    form_atribuicao_pa = AtribuicaoPerifericoPAForm()
    
    # Organizando o contexto em seções para melhor manutenção
    # Contagens para estatísticas (filtradas por loja)
    contagens = {
        'tipos_perifericos': TipoPeriferico.objects.all().count(),
        'perifericos': Periferico.objects.filter(**filtro_loja).count(),
        'monitores': Monitor.objects.filter(**filtro_loja).count(),
        'salas': Sala.objects.filter(**filtro_loja).count(),
        'ilhas': Ilha.objects.filter(sala__in=Sala.objects.filter(**filtro_loja)).count(),
        'posicoes_atendimento': PosicaoAtendimento.objects.filter(sala__in=Sala.objects.filter(**filtro_loja)).count(),
        'atribuicoes_funcionarios': AtribuicaoFuncionarioPA.objects.filter(
            ativo=True,
            posicao_atendimento__sala__in=Sala.objects.filter(**filtro_loja)
        ).count(),
        'atribuicoes_perifericos': AtribuicaoPerifericoPA.objects.filter(
            ativo=True,
            periferico__in=Periferico.objects.filter(**filtro_loja)
        ).count(),
        'atribuicoes_monitores': AtribuicaoMonitorPA.objects.filter(
            ativo=True,
            monitor__in=Monitor.objects.filter(**filtro_loja)
        ).count(),
    }
    
    # Listas de objetos para os campos select (filtradas por loja)
    selects = {
        'tipos_perifericos_list': TipoPeriferico.objects.all(),
        'salas_list': Sala.objects.filter(**filtro_loja).select_related('loja'),
        'funcionarios_list': Funcionario.objects.filter(
            Q(empresa__lojas__id=loja_selecionada) if loja_selecionada else Q()
        ).order_by('nome_completo'),
        'perifericos_list': Periferico.objects.filter(status='disponivel', **filtro_loja),
        'monitores_list': Monitor.objects.filter(status='disponivel', **filtro_loja),
        'posicoes_atendimento_list': PosicaoAtendimento.objects.filter(
            sala__in=Sala.objects.filter(**filtro_loja)
        ),
        'computadores_list': Computador.objects.filter(status='disponivel', **filtro_loja),
        'lojas_list': lojas,
        'empresas_list': Empresa.objects.filter(status=True),
        'ramais_list': Ramal.objects.filter(funcionario__isnull=True).order_by('numero'),
    }
    
    # Formulários
    forms = {
        'form_periferico': form_periferico,
        'form_atribuicao_pa': form_atribuicao_pa,
        'coordenador_sala_form': CoordenadorSalaForm(loja_id=loja_selecionada),
    }
    
    # Montando o contexto completo
    context = {
        'title': 'Administração - TI',
        'loja_selecionada': loja_selecionada,
        'loja_atual': loja_atual,
        'lojas': lojas,
        'funcionarios': selects['funcionarios_list'],  # Adicionar funcionarios para o template
        **contagens,
        **selects,
        **forms,
    }
    
    return render(request, 'ti/admin.html', context)

@login_required
def coordenador_sala_create(request):
    """
    View para criar associação de coordenador/supervisor a uma sala.
    """
    if request.method == 'POST':
        # Obter loja_id do POST para filtrar salas
        loja_id = request.POST.get('loja_id')
        form = CoordenadorSalaForm(request.POST, loja_id=loja_id)
        
        if form.is_valid():
            coordenador = form.save()
            messages.success(request, f'{coordenador.get_tipo_display()} associado à sala {coordenador.sala.nome} com sucesso!')
            return redirect('ti:admin')
        else:
            messages.error(request, 'Erro ao associar coordenador. Verifique os dados informados.')
    else:
        # Para GET, obter loja_id da query string
        loja_id = request.GET.get('loja')
        form = CoordenadorSalaForm(loja_id=loja_id)
    
    # Obter dados para o contexto
    lojas = Loja.objects.filter(status=True).order_by('nome')
    
    context = {
        'form': form,
        'lojas_list': lojas,
        'title': 'Associar Coordenador/Supervisor à Sala',
    }
    return render(request, 'ti/admin.html', context)

@login_required
def loja_list(request):
    lojas = Loja.objects.all()
    context = {
        'title': 'Lojas',
        'lojas': lojas,
    }
    return render(request, 'ti/loja_list.html', context)

@login_required
def controle_salas(request):
    # Obter todas as lojas ativas para o seletor
    lojas = Loja.objects.filter(status=True).order_by('nome')
    
    # Obter a loja selecionada, se houver
    loja_id = request.GET.get('loja')
    loja_selecionada = None
    loja_atual = None
    
    # Filtrar por loja, se for selecionada
    if loja_id:
        try:
            loja_selecionada = int(loja_id)
            loja_atual = get_object_or_404(Loja, id=loja_selecionada)
        except (ValueError, TypeError):
            loja_selecionada = None
    else:
        # Se nenhuma loja for selecionada, usar a loja SEDE como padrão
        try:
            loja_sede = Loja.objects.get(nome='SEDE')
            loja_selecionada = loja_sede.id
            loja_atual = loja_sede
        except Loja.DoesNotExist:
            # Se não encontrar SEDE, usar a primeira loja disponível
            if lojas.exists():
                primeira_loja = lojas.first()
                loja_selecionada = primeira_loja.id
                loja_atual = primeira_loja
    
    # Aplicar filtro de loja nas consultas
    filtro_loja = {'loja_id': loja_selecionada} if loja_selecionada else {}
    
    # Verificar se o usuário é coordenador/supervisor e filtrar salas
    usuario_restrito = False
    salas_permitidas = None
    
    try:
        if hasattr(request.user, 'funcionario_profile') and request.user.funcionario_profile:
            funcionario = request.user.funcionario_profile
            if funcionario.cargo and funcionario.cargo.hierarquia in [3, 6]:  # COORDENADOR = 3, SUPERVISOR_GERAL = 6
                usuario_restrito = True
                # Buscar salas associadas ao coordenador/supervisor
                coordenacoes_ativas = CoordenadorSala.objects.filter(
                    funcionario=funcionario,
                    ativo=True
                ).values_list('sala_id', flat=True)
                
                if coordenacoes_ativas:
                    salas_permitidas = list(coordenacoes_ativas)
    except Exception:
        pass  # Se houver erro, manter como False (sem restrição)
    
    # Carregar salas com filtro de loja e coordenação (se aplicável)
    if usuario_restrito and salas_permitidas:
        # Filtrar por loja E por salas permitidas para o coordenador
        filtro_salas = {**filtro_loja, 'id__in': salas_permitidas}
        salas = Sala.objects.filter(**filtro_salas).prefetch_related('ilhas')
    elif usuario_restrito and not salas_permitidas:
        # Coordenador sem salas associadas - não mostrar nenhuma sala
        salas = Sala.objects.none()
    else:
        # Usuário sem restrição - mostrar todas as salas da loja
        salas = Sala.objects.filter(**filtro_loja).prefetch_related('ilhas')
    ilhas = Ilha.objects.filter(sala__in=salas).select_related('sala')
    
    # Carrega todas as posições de atendimento com seus relacionamentos (filtradas por salas da loja)
    posicoes = PosicaoAtendimento.objects.filter(
        sala__in=salas
    ).select_related('ilha', 'sala').prefetch_related(
        'atribuicaofuncionariopa_set',
        'atribuicaoperifericopa_set__periferico__tipo',
        'atribuicaocomputadorpa_set__computador'
    )
    
    # Obter funcionários atribuídos a cada PA (otimizado com filtro de PA)
    funcionarios_por_pa = {}
    atribuicoes_funcionarios = AtribuicaoFuncionarioPA.objects.filter(
        ativo=True,
        posicao_atendimento__sala__in=salas
    ).select_related('funcionario', 'posicao_atendimento')
    
    for atribuicao in atribuicoes_funcionarios:
        pa_id = atribuicao.posicao_atendimento.id
        funcionarios_por_pa[pa_id] = atribuicao.funcionario
    
    # Obter todos os tipos de periféricos
    tipos_perifericos = TipoPeriferico.objects.all()
    # Lista de tipos comuns/esperados para cada PA (usado para verificar o que está faltando)
    tipos_perifericos_comuns = TipoPeriferico.objects.filter(nome__in=[
        'Mouse', 'Teclado', 'Monitor', 'Fone', 'Mousepad'
    ])
    
    # Carrega os periféricos atribuídos a cada PA (otimizado com filtro de PA)
    perifericos_por_pa = {}
    perifericos_faltando_por_pa = {} # Para rastrear tipos de periféricos faltantes em cada PA
    
    atribuicoes = AtribuicaoPerifericoPA.objects.filter(
        ativo=True,
        posicao_atendimento__sala__in=salas
    ).select_related('periferico', 'periferico__tipo', 'posicao_atendimento')
    
    # Inicializar o dicionário para rastrear periféricos faltantes para todas as PAs
    for pa in posicoes:
        perifericos_faltando_por_pa[pa.id] = {
            'tipos': [t for t in tipos_perifericos_comuns],  # Lista de objetos TipoPeriferico
            'nomes': [t.nome for t in tipos_perifericos_comuns]  # Lista de nomes para facilitar verificação
        }
    
    for atribuicao in atribuicoes:
        pa_id = atribuicao.posicao_atendimento.id
        if pa_id not in perifericos_por_pa:
            perifericos_por_pa[pa_id] = []
        
        perifericos_por_pa[pa_id].append({
            'tipo': atribuicao.periferico.tipo.nome,
            'marca': atribuicao.periferico.marca,
            'modelo': atribuicao.periferico.modelo,
            'id': atribuicao.periferico.id
        })
        
        # Remover da lista de tipos faltantes
        tipo_atual = atribuicao.periferico.tipo
        if pa_id in perifericos_faltando_por_pa and tipo_atual.nome in perifericos_faltando_por_pa[pa_id]['nomes']:
            # Remover o tipo da lista de faltantes
            tipo_index = perifericos_faltando_por_pa[pa_id]['nomes'].index(tipo_atual.nome)
            perifericos_faltando_por_pa[pa_id]['nomes'].pop(tipo_index)
            perifericos_faltando_por_pa[pa_id]['tipos'].pop(tipo_index)
    
    # Carregar periféricos disponíveis por tipo
    perifericos_disponiveis_por_tipo = {}
    for tipo in tipos_perifericos_comuns:
        perifericos_disponiveis_por_tipo[tipo.id] = Periferico.objects.filter(
            tipo=tipo, 
            status='disponivel'
        ).values('id', 'marca', 'modelo')
    
    # Carrega os computadores atribuídos a cada PA (otimizado com filtro de PA)
    computadores_por_pa = {}
    atribuicoes_computador = AtribuicaoComputadorPA.objects.filter(
        ativo=True,
        posicao_atendimento__sala__in=salas
    ).select_related('computador', 'posicao_atendimento')
    
    for atribuicao in atribuicoes_computador:
        pa_id = atribuicao.posicao_atendimento.id
        if pa_id not in computadores_por_pa:
            computadores_por_pa[pa_id] = []
        computadores_por_pa[pa_id].append({
            'marca': atribuicao.computador.marca,
            'id': atribuicao.computador.id
        })
    
    # A verificação de usuario_restrito já foi feita acima
    
    context = {
        'title': 'Controle de Salas - TI',
        'salas': salas,
        'ilhas': ilhas,
        'posicoes': posicoes,
        'funcionarios_por_pa': funcionarios_por_pa,
        'perifericos_por_pa': perifericos_por_pa,
        'computadores_por_pa': computadores_por_pa,
        'perifericos_faltando_por_pa': perifericos_faltando_por_pa,
        'perifericos_disponiveis_por_tipo': perifericos_disponiveis_por_tipo,
        'tipos_perifericos_comuns': tipos_perifericos_comuns,
        'lojas': lojas,
        'loja_selecionada': loja_selecionada,
        'loja_atual': loja_atual,
        'usuario_restrito': usuario_restrito,
    }
    return render(request, 'ti/controle_salas.html', context)

@login_required
def controle_estoque(request):
    """
    View para exibir o controle de estoque de periféricos por sala e ilha.
    Mostra uma tabela com a contagem de periféricos de cada tipo em cada sala/ilha.
    Permite filtrar por loja selecionada.
    """
    
    # Obter todas as lojas ativas para o seletor
    lojas = Loja.objects.filter(status=True).order_by('nome')
    
    # Obter a loja selecionada, se houver
    loja_id = request.GET.get('loja')
    loja_selecionada = None
    loja_atual = None
    
    # Filtrar por loja, se for selecionada
    if loja_id:
        try:
            loja_selecionada = int(loja_id)
            loja_atual = get_object_or_404(Loja, id=loja_selecionada)
        except (ValueError, TypeError):
            loja_selecionada = None
    else:
        # Se nenhuma loja for selecionada, priorizar SEDE como padrão
        try:
            loja_sede = lojas.get(nome='SEDE')
            loja_selecionada = loja_sede.id
            loja_atual = loja_sede
        except Loja.DoesNotExist:
            # Se SEDE não existir, usar a primeira loja disponível
            if lojas.exists():
                primeira_loja = lojas.first()
                loja_selecionada = primeira_loja.id
                loja_atual = primeira_loja
    
    # Obter todas as salas com ilhas pré-carregadas
    if loja_selecionada:
        salas = Sala.objects.filter(loja_id=loja_selecionada).prefetch_related(
            Prefetch('ilhas', queryset=Ilha.objects.filter(sala__loja_id=loja_selecionada).order_by('nome'))
        )
    else:
        salas = Sala.objects.all().prefetch_related(
            Prefetch('ilhas', queryset=Ilha.objects.all().order_by('nome'))
        )

    
    # Obter todos os tipos de periféricos
    tipos_perifericos = TipoPeriferico.objects.all().order_by('nome')
    
    # Calcular o total de periféricos por tipo (independentemente de atribuição)
    perifericos_totais_por_tipo = {}
    filtro_loja = {'loja_id': loja_selecionada} if loja_selecionada else {}
    
    for tipo in tipos_perifericos:
        # Contar todos os periféricos deste tipo, independente de estarem atribuídos a PAs
        # Usando Sum('quantidade') em vez de count() para obter o número real de unidades
        # Incluindo periféricos disponíveis e em manutenção
        # Obter IDs de periféricos em uso na loja selecionada
        atribuicoes_query = AtribuicaoPerifericoPA.objects.filter(ativo=True)
        if loja_selecionada:
            atribuicoes_query = atribuicoes_query.filter(periferico__loja_id=loja_selecionada)
        
        perifericos_em_uso_ids = atribuicoes_query.values_list('periferico_id', flat=True)
        
        total_tipo = Periferico.objects.filter(
            tipo=tipo, 
            status__in=['disponivel', 'manutencao'],  # Periféricos disponíveis e em manutenção
            **filtro_loja
        ).exclude(
            id__in=perifericos_em_uso_ids
        ).aggregate(total=Sum('quantidade'))['total'] or 0
        
        perifericos_totais_por_tipo[tipo.id] = total_tipo
    
    # Calcular o total geral de periféricos disponíveis (soma de todos os tipos)
    total_geral_perifericos = sum(perifericos_totais_por_tipo.values())
    
    # Inicializar dicionário para contagem de periféricos por sala/ilha/tipo
    perifericos_por_sala_ilha = {}
    
    # Usar Sum com annotate para calcular de forma mais eficiente a quantidade de periféricos em uso
    # Agrupar por sala, ilha e tipo de periférico
    perifericos_em_uso = AtribuicaoPerifericoPA.objects.filter(
        ativo=True
    ).select_related(
        'posicao_atendimento', 'posicao_atendimento__sala', 'posicao_atendimento__ilha', 'periferico', 'periferico__tipo'
    )
    
    if loja_selecionada:
        perifericos_em_uso = perifericos_em_uso.filter(periferico__loja_id=loja_selecionada)
    
    # Calcular o total geral de periféricos disponíveis (não em uso)
    # Este será calculado após o loop dos perifericos_totais_por_tipo
    
    # Inicializar estrutura para todas as salas e ilhas
    for sala in salas:
        perifericos_por_sala_ilha[sala.id] = {}
        for ilha in sala.ilhas.all():
            perifericos_por_sala_ilha[sala.id][ilha.id] = {}
            # Inicializar contador para cada tipo de periférico nesta ilha
            for tipo in tipos_perifericos:
                perifericos_por_sala_ilha[sala.id][ilha.id][tipo.id] = 0
    
    # Processar cada periférico em uso
    for atribuicao in perifericos_em_uso:
        pa = atribuicao.posicao_atendimento
        if not pa.sala_id or not pa.ilha_id:
            continue  # Pular se não tiver sala ou ilha atribuída
            
        periferico = atribuicao.periferico
        tipo_id = periferico.tipo_id
        quantidade = periferico.quantidade if hasattr(periferico, 'quantidade') else 1
        
        # Se a estrutura existir, incrementar a contagem
        if (pa.sala_id in perifericos_por_sala_ilha and 
            pa.ilha_id in perifericos_por_sala_ilha[pa.sala_id] and
            tipo_id in perifericos_por_sala_ilha[pa.sala_id][pa.ilha_id]):
            
            perifericos_por_sala_ilha[pa.sala_id][pa.ilha_id][tipo_id] += quantidade
    
    # Calcular o total de periféricos em uso por tipo
    total_por_tipo_periferico = {}
    for tipo in tipos_perifericos:
        # Inicializar contagem para cada tipo
        total_por_tipo_periferico[tipo.id] = 0
        
        # Somar para cada sala e ilha
        for sala_id in perifericos_por_sala_ilha:
            for ilha_id in perifericos_por_sala_ilha[sala_id]:
                if tipo.id in perifericos_por_sala_ilha[sala_id][ilha_id]:
                    total_por_tipo_periferico[tipo.id] += perifericos_por_sala_ilha[sala_id][ilha_id][tipo.id]
    
    # Obter contagem de computadores cadastrados de forma otimizada (filtrado por loja)
    if loja_selecionada:
        computadores_cadastrados_total = Computador.objects.filter(loja_id=loja_selecionada).count()
    else:
        computadores_cadastrados_total = Computador.objects.all().count()

    # Contagem de computadores em uso por sala/ilha - abordagem mais eficiente
    computadores_em_uso_por_sala_ilha = {}
    computadores_em_uso_total_geral = 0
    
    # Pré-calcular contagens de computadores por ilha usando agregação (filtrado por loja)
    contagens_computadores_query = AtribuicaoComputadorPA.objects.filter(ativo=True)
    if loja_selecionada:
        contagens_computadores_query = contagens_computadores_query.filter(
            computador__loja_id=loja_selecionada
        )
    
    contagens_computadores_por_ilha = (
        contagens_computadores_query
        .values('posicao_atendimento__ilha')
        .annotate(count=Count('computador', distinct=True))
    )
    
    # Criar dicionário de contagens para acesso rápido
    contagens_dict = {item['posicao_atendimento__ilha']: item['count'] 
                     for item in contagens_computadores_por_ilha if item['posicao_atendimento__ilha'] is not None}
    
    # Preencher o dicionário de contagens por sala/ilha
    for sala in salas:
        computadores_em_uso_por_sala_ilha[sala.id] = {}
        for ilha in sala.ilhas.all():
            # Obter a contagem do dicionário pré-calculado ou usar 0
            contagem_ilha_atual = contagens_dict.get(ilha.id, 0)
            computadores_em_uso_por_sala_ilha[sala.id][ilha.id] = contagem_ilha_atual
            computadores_em_uso_total_geral += contagem_ilha_atual

    # Computadores em uso - Query mais eficiente (filtrado por loja)
    ids_computadores_query = AtribuicaoComputadorPA.objects.filter(ativo=True)
    if loja_selecionada:
        ids_computadores_query = ids_computadores_query.filter(
            computador__loja_id=loja_selecionada
        )
    
    ids_computadores_em_uso = ids_computadores_query.values_list('computador_id', flat=True).distinct()
    
    # Computadores disponíveis - Cálculo será feito abaixo após a contagem por marca
    # Aplicar filtro de loja se necessário
    # Incluindo computadores disponíveis e em manutenção
    computadores_query = Computador.objects.filter(status__in=['disponivel', 'manutencao'])
    if loja_selecionada:
        computadores_query = computadores_query.filter(loja_id=loja_selecionada)
    
    # Total de computadores cadastrados já foi calculado acima

    # Calcular computadores disponíveis POR MARCA (incluindo marcas com 0 disponíveis)
    # ids_computadores_em_uso já foi definido acima
    
    # 1. Obter todas as marcas distintas cadastradas de computadores (para garantir que todas apareçam na lista)
    todas_as_marcas_cadastradas = Computador.objects.all()
    
    # Aplicar filtro de loja se necessário
    if loja_selecionada:
        todas_as_marcas_cadastradas = todas_as_marcas_cadastradas.filter(loja_id=loja_selecionada)
    
    todas_as_marcas_cadastradas = todas_as_marcas_cadastradas.values_list('marca', flat=True).distinct().order_by('marca')
    
    # 2. Obter a contagem de computadores REALMENTE disponíveis por marca
    #    (status='disponivel' ou 'manutencao' E não estão em uso)
    contagem_disponiveis_raw = Computador.objects.filter(
        status__in=['disponivel', 'manutencao']
    ).exclude(
        id__in=ids_computadores_em_uso
    )
    
    # Aplicar filtro de loja para computadores disponíveis
    if loja_selecionada:
        contagem_disponiveis_raw = contagem_disponiveis_raw.filter(loja_id=loja_selecionada)
    
    contagem_disponiveis_raw = contagem_disponiveis_raw.values('marca').annotate(
        quantidade_disponivel=Sum('quantidade') # Somar o campo quantidade para obter o total real
    ).order_by('marca')
    
    # 3. Criar um dicionário com as contagens de disponíveis para consulta rápida
    disponiveis_dict = {item['marca']: item['quantidade_disponivel'] for item in contagem_disponiveis_raw}
    
    # 4. Montar a lista final, garantindo todas as marcas com suas respectivas quantidades (ou 0)
    computadores_disponiveis_por_marca_list = []
    total_soma_marcas = 0  # Inicializar contador para soma total
    
    for marca_nome in todas_as_marcas_cadastradas:
        quantidade_marca = disponiveis_dict.get(marca_nome, 0)
        total_soma_marcas += quantidade_marca  # Adicionar ao total
        computadores_disponiveis_por_marca_list.append({
            'marca': marca_nome,
            'quantidade_disponivel': quantidade_marca # Usa 0 se a marca não estiver no dict de disponíveis
        })
    
    # Usar a soma calculada acima para garantir consistência
    computadores_disponiveis_total = total_soma_marcas

    # --- Construção do Histórico de Movimentações de forma otimizada --- 
    
    # Define a quantidade máxima de registros a serem retornados de cada tabela
    limite_registros = 500  # Limite para melhorar a performance
    itens_por_pagina = 20   # Aumentamos a quantidade para mostrar mais histórico por página
    
    # 1. Buscar histórico de movimentações de PERIFÉRICOS com limite para melhorar performance (filtrado por loja)
    perifericos_query = AtribuicaoPerifericoPA.objects\
        .select_related('periferico', 'periferico__tipo', 'posicao_atendimento__ilha', 'posicao_atendimento__sala')
    
    if loja_selecionada:
        perifericos_query = perifericos_query.filter(periferico__loja_id=loja_selecionada)
    
    perifericos_query = perifericos_query.order_by('-data_atribuicao')[:limite_registros]
    
    historico_movimentacoes = []
    
    # Processar atribuições de periféricos
    for atribuicao in perifericos_query:
        pa = atribuicao.posicao_atendimento
        periferico = atribuicao.periferico
        
        # Construir local e descrição do item uma única vez por atribuição
        sala_nome = pa.sala.nome if pa.sala else 'S/Sala'
        ilha_nome = pa.ilha.nome if pa.ilha else 'S/Ilha'
        local = f"{sala_nome}, {ilha_nome} - PA {pa.numero}"
        item_descricao = f"Periférico: {periferico.tipo.nome} {periferico.marca} {periferico.modelo or ''}"
        
        # Evento de adição
        if atribuicao.data_atribuicao:
            historico_movimentacoes.append({
                'data_evento': atribuicao.data_atribuicao,
                'tipo_evento': 'Adicionado em',
                'item_movimentado': item_descricao,
                'local': local,
                'tipo_item': 'periferico'
            })
        
        # Evento de remoção
        if atribuicao.data_remocao:
            historico_movimentacoes.append({
                'data_evento': atribuicao.data_remocao,
                'tipo_evento': 'Removido de',
                'item_movimentado': item_descricao,
                'local': local,
                'tipo_item': 'periferico'
            })

    # 2. Buscar histórico de movimentações de COMPUTADORES com limite para melhorar performance (filtrado por loja)
    computadores_query = AtribuicaoComputadorPA.objects\
        .select_related('computador', 'posicao_atendimento__ilha', 'posicao_atendimento__sala')
    
    if loja_selecionada:
        computadores_query = computadores_query.filter(computador__loja_id=loja_selecionada)
    
    computadores_query = computadores_query.order_by('-data_atribuicao')[:limite_registros]
    
    # Processar atribuições de computadores
    for atribuicao in computadores_query:
        pa = atribuicao.posicao_atendimento
        computador = atribuicao.computador
        
        # Construir local e descrição do item uma única vez por atribuição
        sala_nome = pa.sala.nome if pa.sala else 'S/Sala'
        ilha_nome = pa.ilha.nome if pa.ilha else 'S/Ilha'
        local = f"{sala_nome}, {ilha_nome} - PA {pa.numero}"
        item_descricao = f"Computador: {computador.marca}"
        
        # Evento de adição
        if atribuicao.data_atribuicao:
            historico_movimentacoes.append({
                'data_evento': atribuicao.data_atribuicao,
                'tipo_evento': 'Adicionado em',
                'item_movimentado': item_descricao,
                'local': local,
                'tipo_item': 'computador'
            })
        
        # Evento de remoção
        if atribuicao.data_remocao:
            historico_movimentacoes.append({
                'data_evento': atribuicao.data_remocao,
                'tipo_evento': 'Removido de',
                'item_movimentado': item_descricao,
                'local': local,
                'tipo_item': 'computador'
            })
    
    # Ordenar o histórico combinado por data_evento, mais recentes primeiro
    historico_movimentacoes = [item for item in historico_movimentacoes if item.get('data_evento')]
    historico_movimentacoes.sort(key=lambda x: x['data_evento'], reverse=True)
    
    # Obter a data da última atualização para o contexto
    data_ultima_atualizacao_real = None
    if historico_movimentacoes:
        data_ultima_atualizacao_real = historico_movimentacoes[0]['data_evento']
    
    # Usar a função auxiliar de paginação
    page_obj = paginate_queryset(request, historico_movimentacoes, itens_por_pagina)
    # Obter metadados de paginação para o template
    pagination_data = get_pagination_data(page_obj)

    # Dados adicionais de computadores que estavam faltando (filtrado por loja)
    computadores_manutencao_query = Computador.objects.filter(status='manutencao')
    if loja_selecionada:
        computadores_manutencao_query = computadores_manutencao_query.filter(loja_id=loja_selecionada)
    computadores_manutencao = computadores_manutencao_query.count()
    
    # Computadores em uso que não estão atribuídos a uma PA (filtrado por loja)
    computadores_em_uso_query = Computador.objects.filter(status='em_uso')
    if loja_selecionada:
        computadores_em_uso_query = computadores_em_uso_query.filter(loja_id=loja_selecionada)
    computadores_em_uso = computadores_em_uso_query.count()
    computadores_em_uso_sem_pa = computadores_em_uso - computadores_em_uso_total_geral
    if computadores_em_uso_sem_pa < 0:
        computadores_em_uso_sem_pa = 0
        
    # Dados de monitores
    # Incluindo monitores disponíveis e em manutenção
    monitores_query = Monitor.objects.filter(status__in=['disponivel', 'manutencao'])
    if loja_selecionada:
        monitores_query = monitores_query.filter(loja_id=loja_selecionada)
    
    monitores_count = monitores_query.count()
    
    # Calcular monitores disponíveis POR MARCA (incluindo marcas com 0 disponíveis)
    # 1. Obter todas as marcas distintas cadastradas de monitores
    todas_as_marcas_monitores = Monitor.objects.all()
    
    # Aplicar filtro de loja se necessário
    if loja_selecionada:
        todas_as_marcas_monitores = todas_as_marcas_monitores.filter(loja_id=loja_selecionada)
    
    todas_as_marcas_monitores = todas_as_marcas_monitores.values_list('marca', flat=True).distinct().order_by('marca')
    
    # 2. Obter a contagem de monitores REALMENTE disponíveis por marca
    contagem_monitores_disponiveis = Monitor.objects.filter(
        status__in=['disponivel', 'manutencao']
    )
    
    # Aplicar filtro de loja para monitores disponíveis
    if loja_selecionada:
        contagem_monitores_disponiveis = contagem_monitores_disponiveis.filter(loja_id=loja_selecionada)
    
    contagem_monitores_disponiveis = contagem_monitores_disponiveis.values('marca').annotate(
        quantidade_disponivel=Count('id')
    ).order_by('marca')
    
    # 3. Criar um dicionário com as contagens de disponíveis para consulta rápida
    monitores_disponiveis_dict = {item['marca']: item['quantidade_disponivel'] for item in contagem_monitores_disponiveis}
    
    # 4. Montar a lista final, garantindo todas as marcas com suas respectivas quantidades (ou 0)
    monitores_disponiveis_por_marca_list = []
    
    for marca_nome in todas_as_marcas_monitores:
        if marca_nome:  # Só incluir marcas que não sejam None ou vazias
            quantidade_marca = monitores_disponiveis_dict.get(marca_nome, 0)
            monitores_disponiveis_por_marca_list.append({
                'marca': marca_nome,
                'quantidade_disponivel': quantidade_marca
            })
        
    # Contexto para o template
    context = {
        'salas': salas,
        'tipos_perifericos': tipos_perifericos,
        'perifericos_por_sala_ilha': perifericos_por_sala_ilha,
        'total_geral_perifericos': total_geral_perifericos,
        'perifericos_totais_por_tipo': perifericos_totais_por_tipo,
        'total_por_tipo_periferico': total_por_tipo_periferico,
        'historico_page_obj': page_obj, # Passa o objeto da página para o template
        'pagination_data': pagination_data, # Adiciona metadados de paginação
        'data_ultima_atualizacao_real': data_ultima_atualizacao_real, # Adiciona a data ao contexto
        'computadores_cadastrados_total': computadores_cadastrados_total,
        'computadores_em_uso_por_sala_ilha': computadores_em_uso_por_sala_ilha,
        'computadores_em_uso_total_geral': computadores_em_uso_total_geral,
        'computadores_disponiveis_total': computadores_disponiveis_total,
        'computadores_disponiveis_por_marca_list': computadores_disponiveis_por_marca_list,
        'computadores_manutencao': computadores_manutencao,
        'computadores_em_uso_sem_pa': computadores_em_uso_sem_pa,
        'monitores_count': monitores_count,
        'monitores_disponiveis_por_marca_list': monitores_disponiveis_por_marca_list,
    }
    
    return render(request, 'ti/controle_estoque.html', context)

# ============================================================================
# APIS - COMPUTADORES
# ============================================================================

@require_POST
@login_required
def api_post_computador_adicionar_pa(request, pa_id):
    """
    API POST para adicionar computador a uma posição de atendimento.
    
    Args:
        request: HttpRequest com dados JSON contendo computador_id
        pa_id: ID da posição de atendimento
    
    Returns:
        JsonResponse com resultado da operação
    """
    try:
        # Extrair dados JSON
        json_result = extract_json_data(request)
        if not json_result['success']:
            return JsonResponse(
                build_response_data(False, error=json_result['error']),
                status=400
            )
        
        data = json_result['data']
        
        # Validar campos obrigatórios
        validation = validate_required_fields(data, {
            'computador_id': 'ID do Computador'
        })
        if not validation['success']:
            return JsonResponse(
                build_response_data(False, error=validation['error']),
                status=400
            )
        
        computador_id = data['computador_id']
        
        # Buscar objetos
        try:
            pa = get_object_or_404(PosicaoAtendimento, pk=pa_id)
            computador = get_object_or_404(Computador, pk=computador_id)
        except Exception:
            return JsonResponse(
                build_response_data(False, error='PA ou Computador não encontrado'),
                status=404
            )
        
        # Verificar disponibilidade
        disponivel, mensagem = verificar_disponibilidade_computador(computador_id, pa_id=pa_id)
        if not disponivel:
            return JsonResponse(
                build_response_data(False, error=mensagem),
                status=400
            )
        
        # Atribuir computador à PA
        atribuir_item_pa(computador, pa, AtribuicaoComputadorPA)
        
        # Preparar resposta
        response_data = {
            'lista_computadores_pa': listar_itens_atribuidos_pa(pa, 'computador'),
            'pa_id': pa_id,
            'computador_id': computador_id
        }
        
        return JsonResponse(
            build_response_data(
                True,
                message='Computador adicionado à PA com sucesso!',
                data=response_data
            )
        )
        
    except Exception as e:
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

@require_POST
@login_required
def api_post_computador_remover_pa(request, pa_id):
    """
    API POST para remover computador de uma posição de atendimento.
    
    Args:
        request: HttpRequest com dados JSON contendo computador_id
        pa_id: ID da posição de atendimento
    
    Returns:
        JsonResponse com resultado da operação
    """
    try:
        # Extrair dados JSON
        json_result = extract_json_data(request)
        if not json_result['success']:
            return JsonResponse(
                build_response_data(False, error=json_result['error']),
                status=400
            )
        
        data = json_result['data']
        
        # Validar campos obrigatórios
        validation = validate_required_fields(data, {
            'computador_id': 'ID do Computador'
        })
        if not validation['success']:
            return JsonResponse(
                build_response_data(False, error=validation['error']),
                status=400
            )
        
        computador_id = data['computador_id']
        
        # Buscar objetos
        try:
            pa = get_object_or_404(PosicaoAtendimento, pk=pa_id)
            computador = get_object_or_404(Computador, pk=computador_id)
        except Exception:
            return JsonResponse(
                build_response_data(False, error='PA ou Computador não encontrado'),
                status=404
            )

        # Verificar se existe atribuição ativa
        atribuicao_ativa = AtribuicaoComputadorPA.objects.filter(
            posicao_atendimento=pa, 
            computador=computador, 
            ativo=True
        ).first()

        if not atribuicao_ativa:
            return JsonResponse(
                build_response_data(
                    False, 
                    error='Computador não está ativamente atribuído a esta PA.'
                ),
                status=400
            )

        # Desatribuir computador
        desatribuir_item_pa(atribuicao_ativa)
        
        # Preparar dados de resposta
        response_data = {
            'lista_computadores_pa': listar_itens_atribuidos_pa(pa, 'computador'),
            'pa_id': pa_id,
            'computador_id': computador_id
        }

        return JsonResponse(
            build_response_data(
                True,
                message='Computador removido da PA com sucesso!',
                data=response_data
            )
        )

    except Exception as e:
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

@require_POST
@login_required
def api_post_periferico_atualizar_status(request, periferico_id):
    """
    API POST para atualizar status de um periférico.
    
    Args:
        request: HttpRequest com dados JSON contendo status, pa_id e observacoes
        periferico_id: ID do periférico
    
    Returns:
        JsonResponse com resultado da operação
    """
    try:
        # Extrair dados JSON
        json_result = extract_json_data(request)
        if not json_result['success']:
            return JsonResponse(
                build_response_data(False, error=json_result['error']),
                status=400
            )
        
        data = json_result['data']
        
        # Validar campos obrigatórios
        validation = validate_required_fields(data, {
            'status': 'Status'
        })
        if not validation['success']:
            return JsonResponse(
                build_response_data(False, error=validation['error']),
                status=400
            )
        
        novo_status = data['status']
        pa_id = data.get('pa_id')
        observacoes = data.get('observacoes')
        
        # Validar status
        status_validation = validate_status(novo_status, STATUS_CHOICES['periferico'])
        if not status_validation['success']:
            return JsonResponse(
                build_response_data(False, error=status_validation['error']),
                status=400
            )
        
        # Buscar periférico
        try:
            periferico = get_object_or_404(Periferico, pk=periferico_id)
        except Exception:
            return JsonResponse(
                build_response_data(False, error='Periférico não encontrado'),
                status=404
            )
        
        # Atualizar status
        periferico.status = novo_status
        # Atualizar observações baseado no status
        if novo_status == 'manutencao':
            if observacoes:
                periferico.observacoes = observacoes
            else:
                periferico.observacoes = None
        elif novo_status == 'disponivel':
            if periferico.observacoes and periferico.observacoes.startswith("MANUTENÇÃO:"):
                periferico.observacoes = None
        
        periferico.save()
        
        mensagem = f'Status do periférico {periferico.tipo.nome} {periferico.marca} atualizado para {periferico.get_status_display()}.'
        periferico_removido_da_pa_especifica = False

        # Lógica adicional baseada no novo status e na PA de origem
        if novo_status == 'disponivel' and pa_id:
            # Se o periférico foi marcado como 'disponível' e estava associado a uma PA específica (via frontend context),
            # devemos desassociá-lo dessa PA.
            atribuicao_especifica = AtribuicaoPerifericoPA.objects.filter(
                periferico=periferico,
                posicao_atendimento_id=pa_id,
                ativo=True
            ).first()
            
            if atribuicao_especifica:
                atribuicao_especifica.ativo = False
                atribuicao_especifica.data_remocao = timezone.now()
                atribuicao_especifica.save()
                periferico_removido_da_pa_especifica = True
                mensagem += f' Ele foi desatribuído da PA {atribuicao_especifica.posicao_atendimento.numero}.'
        
        elif novo_status == 'manutencao' and pa_id:
            # Se o periférico foi marcado como 'Em Manutenção' e estava associado a uma PA específica,
            # também devemos desassociá-lo dessa PA.
            atribuicao_especifica = AtribuicaoPerifericoPA.objects.filter(
                periferico=periferico,
                posicao_atendimento_id=pa_id,
                ativo=True
            ).first()
            
            if atribuicao_especifica:
                atribuicao_especifica.ativo = False
                atribuicao_especifica.data_remocao = timezone.now()
                atribuicao_especifica.save()
                periferico_removido_da_pa_especifica = True
                mensagem += f' Ele foi desatribuído da PA {atribuicao_especifica.posicao_atendimento.numero} para manutenção.'
        
        elif novo_status == 'em_uso' and pa_id:
            # Se marcado como 'Em Uso' e uma pa_id foi fornecida, garantir que ele esteja ativo nessa PA.
            # Se não houver atribuição ativa para esta PA, pode ser necessário criar ou reativar uma.
            # Esta lógica pode ser complexa se um periférico puder estar em várias PAs (o que não é o caso atualmente para "em_uso")
            # Por ora, vamos assumir que se está em uso, já está corretamente atribuído pela interface principal.
            # Apenas garantimos que não haja atribuições ativas conflitantes se este periférico só pode estar em uma PA por vez.
            pass # A atribuição é gerenciada separadamente; aqui apenas atualizamos o status do objeto Periférico.

        # Preparar dados de resposta
        response_data = {
            'novo_status_display': periferico.get_status_display(),
            'periferico_removido_da_pa': periferico_removido_da_pa_especifica
        }
        
        return JsonResponse(
            build_response_data(
                True,
                message=mensagem,
                data=response_data
            )
        )

    except Exception as e:
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

@require_POST
@login_required
def api_post_computador_atualizar_status(request, computador_id):
    """
    API POST para atualizar status de um computador.
    
    Args:
        request: HttpRequest com dados JSON contendo status, pa_id e observacoes
        computador_id: ID do computador
    
    Returns:
        JsonResponse com resultado da operação
    """
    try:
        # Extrair dados JSON
        json_result = extract_json_data(request)
        if not json_result['success']:
            return JsonResponse(
                build_response_data(False, error=json_result['error']),
                status=400
            )
        
        data = json_result['data']
        
        # Validar campos obrigatórios
        validation = validate_required_fields(data, {
            'status': 'Status'
        })
        if not validation['success']:
            return JsonResponse(
                build_response_data(False, error=validation['error']),
                status=400
            )
        
        novo_status = data['status']
        pa_id = data.get('pa_id')
        observacoes = data.get('observacoes')
        
        # Validar status
        status_validation = validate_status(novo_status, STATUS_CHOICES['computador'])
        if not status_validation['success']:
            return JsonResponse(
                build_response_data(False, error=status_validation['error']),
                status=400
            )
        
        # Buscar computador
        try:
            computador = get_object_or_404(Computador, pk=computador_id)
        except Exception:
            return JsonResponse(
                build_response_data(False, error='Computador não encontrado'),
                status=404
            )
        
        # Atualizar status
        computador.status = novo_status
        
        # Atualizar observações baseado no status
        if novo_status == 'manutencao':
            if observacoes:
                computador.observacoes = observacoes
            # Se não temos novas observações, limpamos as antigas para evitar confusão
            else:
                computador.observacoes = None
        elif novo_status == 'disponivel':
            if computador.observacoes and computador.observacoes.startswith("MANUTENÇÃO:"):
                computador.observacoes = None

        computador.save()
        
        # Preparar mensagem e dados de resposta
        partes_mensagem = [
            f'Status do computador {computador.marca} atualizado para {computador.get_status_display()}.'
        ]
        computador_removido_da_pa_especifica = False
        lista_computadores_pa_atualizada = []

        # Lógica de desatribuição baseada no status
        if (novo_status == 'disponivel' or novo_status == 'manutencao') and pa_id:
            atribuicao_especifica = AtribuicaoComputadorPA.objects.filter(
                computador=computador,
                posicao_atendimento_id=pa_id,
                ativo=True
            ).first()
            
            if atribuicao_especifica:
                atribuicao_especifica.ativo = False
                atribuicao_especifica.data_remocao = timezone.now()
                atribuicao_especifica.save()
                computador_removido_da_pa_especifica = True
                acao = "para manutenção" if novo_status == 'manutencao' else "pois está livre"
                partes_mensagem.append(f'Ele foi desatribuído da PA {atribuicao_especifica.posicao_atendimento.numero} {acao}.')
                
                try:
                    pa_alvo = get_object_or_404(PosicaoAtendimento, pk=pa_id)
                    atribuicoes_pa_atual = AtribuicaoComputadorPA.objects.filter(
                        posicao_atendimento=pa_alvo, 
                        ativo=True
                    ).select_related('computador')
                    for atr in atribuicoes_pa_atual:
                        lista_computadores_pa_atualizada.append({
                            'id': atr.computador.id,
                            'marca': atr.computador.marca,
                        })
                except Exception:
                    pass  # Se não conseguir atualizar a lista, continua sem ela
        
        mensagem_final = " ".join(partes_mensagem)
        
        # Preparar dados de resposta
        response_data = {
            'novo_status_display': computador.get_status_display(),
            'computador_removido_da_pa': computador_removido_da_pa_especifica,
            'lista_computadores_pa': lista_computadores_pa_atualizada
        }

        return JsonResponse(
            build_response_data(
                True,
                message=mensagem_final,
                data=response_data
            )
        )

    except Exception as e:
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

@require_GET
@login_required
def api_get_perifericos_disponiveis_por_tipo(request, tipo_id):
    """
    API GET para listar periféricos disponíveis de um determinado tipo.
    
    Args:
        request: HttpRequest com parâmetros GET opcionais (loja)
        tipo_id: ID do tipo de periférico
    
    Returns:
        JsonResponse com lista de periféricos disponíveis
    """
    try:
        # Verificar se o tipo existe
        try:
            tipo = get_object_or_404(TipoPeriferico, pk=tipo_id)
        except Exception:
            return JsonResponse(
                build_response_data(False, error='Tipo de periférico não encontrado'),
                status=404
            )
        
        # Extrair parâmetros de filtro
        filtros = extract_filter_params(request, ['loja'])
        
        # Aplicar filtro de loja se especificado
        filtro_loja = {}
        if filtros.get('loja'):
            try:
                loja_id = int(filtros['loja'])
                filtro_loja = {'loja_id': loja_id}
            except (ValueError, TypeError):
                return JsonResponse(
                    build_response_data(False, error='ID da loja inválido'),
                    status=400
                )
        
        # Buscar periféricos disponíveis
        perifericos_queryset = Periferico.objects.filter(
            tipo=tipo, 
            status__in=['disponivel', 'manutencao'],
            **filtro_loja
        ).select_related('tipo').order_by('marca', 'modelo')
        
        # Serializar dados
        perifericos_data = serialize_object_list(
            perifericos_queryset,
            ['id', 'marca', 'modelo', 'status', 'observacoes']
        )
        
        # Preparar resposta
        response_data = {
            'tipo': {
                'id': tipo.id,
                'nome': tipo.nome
            },
            'perifericos': perifericos_data,
            'total': len(perifericos_data),
            'filtros_aplicados': filtro_loja
        }
        
        return JsonResponse(
            build_response_data(True, data=response_data)
        )
        
    except Exception as e:
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )


# Views para Controle de Manutenção
@login_required
def controle_manutencao(request):
    # Obter periféricos em manutenção
    perifericos_em_manutencao = Periferico.objects.filter(status='manutencao')
    
    # Obter computadores em manutenção
    computadores_em_manutencao = Computador.objects.filter(status='manutencao')
    
    # Lista combinada para o template
    itens_manutencao = []
    
    # Inicializar contador por tipo
    contagem_por_tipo = {
        'Mouse': 0,
        'Teclado': 0,
        'Monitor': 0,
        'Fone': 0,
        'Mousepad': 0,
        'Computador': 0,
        'Outros_Periféricos': 0
    }
    
    # Processar periféricos
    for periferico in perifericos_em_manutencao:
        # Buscar a última PA onde este periférico estava
        ultima_atribuicao = AtribuicaoPerifericoPA.objects.filter(
            periferico=periferico
        ).order_by('-data_atribuicao').first()
        
        # Formatar item para o template
        item = {
            'nome_item': f"{periferico.tipo.nome}",
            'marca_modelo': f"{periferico.marca} {periferico.modelo or ''}".strip(),
            'ultima_pa': ultima_atribuicao.posicao_atendimento if ultima_atribuicao else None,
            'observacoes': periferico.observacoes,
            'id_item': periferico.id,
            'tipo_item_slug': 'periferico'
        }
        
        # Adicionar à lista
        itens_manutencao.append(item)
        
        # Incrementar contador por tipo
        if periferico.tipo.nome in contagem_por_tipo:
            contagem_por_tipo[periferico.tipo.nome] += 1
        else:
            contagem_por_tipo['Outros_Periféricos'] += 1
    
    # Processar computadores
    for computador in computadores_em_manutencao:
        # Buscar a última PA onde este computador estava
        ultima_atribuicao = AtribuicaoComputadorPA.objects.filter(
            computador=computador
        ).order_by('-data_atribuicao').first()
        
        # Formatar item para o template
        item = {
            'nome_item': "Computador",
            'marca_modelo': f"{computador.marca} ({computador.get_condicao_display()})",
            'ultima_pa': ultima_atribuicao.posicao_atendimento if ultima_atribuicao else None,
            'observacoes': computador.observacoes,
            'id_item': computador.id,
            'tipo_item_slug': 'computador'
        }
        
        # Adicionar à lista
        itens_manutencao.append(item)
        
        # Incrementar contador
        contagem_por_tipo['Computador'] += 1
    
    # Calcular total de itens em manutenção
    total_itens_manutencao = sum(contagem_por_tipo.values())
    
    context = {
        'title': 'Controle de Manutenção - TI',
        'itens_manutencao': itens_manutencao,
        'contagem_por_tipo': contagem_por_tipo,
        'total_itens_manutencao': total_itens_manutencao,
    }
    
    return render(request, 'ti/controle_manutencao.html', context)

@login_required
def api_post_marcar_consertado(request, item_id, tipo_item_slug):
    """
    API POST para marcar item como consertado.
    
    Args:
        request: HttpRequest
        item_id: ID do item
        tipo_item_slug: Tipo do item ('periferico' ou 'computador')
    
    Returns:
        JsonResponse com resultado da operação
    """
    if request.method != 'POST':
        return JsonResponse(
            build_response_data(False, error='Método não permitido'),
            status=405
        )
    
    try:
        # Dicionário de configuração para tipos de itens
        item_config = {
            'periferico': {
                'model': Periferico,
                'name_fields': ['marca', 'modelo']
            },
            'computador': {
                'model': Computador,
                'name_fields': ['marca']
            }
        }
        
        # Validar tipo de item
        if tipo_item_slug not in item_config:
            return JsonResponse(
                build_response_data(
                    False, 
                    error='Tipo de item inválido',
                    data={'tipos_validos': list(item_config.keys())}
                ),
                status=400
            )
        
        # Obter configuração do item
        config = item_config[tipo_item_slug]
        model_class = config['model']
        name_fields = config['name_fields']
        
        # Buscar item
        item = get_object_or_404(model_class, id=item_id)
        
        # Atualizar status
        item.status = 'disponivel'
        item.save()
        
        # Construir nome do item para resposta
        item_name = ' '.join(getattr(item, field, '') for field in name_fields)
        
        return JsonResponse(
            build_response_data(
                True,
                message=f'{tipo_item_slug.title()} {item_name} marcado como consertado',
                data={
                    'item_id': item.id,
                    'tipo': tipo_item_slug,
                    'nome': item_name,
                    'status': item.status
                }
            )
        )
        
    except Exception as e:
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

@login_required
def api_post_excluir_item(request, item_id, tipo_item_slug):
    """
    API POST para excluir permanentemente um periférico ou computador.
    Usado quando o item não tem mais conserto e precisa ser descartado.
    
    Args:
        request: HttpRequest
        item_id: ID do item
        tipo_item_slug: Tipo do item ('periferico' ou 'computador')
    
    Returns:
        JsonResponse com resultado da operação
    """
    if request.method != 'POST':
        return JsonResponse(
            build_response_data(False, error='Método não permitido'),
            status=405
        )
    
    try:
        # Dicionário de configuração para tipos de itens
        item_config = {
            'periferico': {
                'model': Periferico,
                'name_fields': ['marca', 'modelo'],
                'display_name': 'Periférico'
            },
            'computador': {
                'model': Computador,
                'name_fields': ['marca'],
                'display_name': 'Computador'
            }
        }
        
        # Validar tipo de item
        if tipo_item_slug not in item_config:
            return JsonResponse(
                build_response_data(
                    False,
                    error='Tipo de item inválido',
                    data={'tipos_validos': list(item_config.keys())}
                ),
                status=400
            )
        
        # Obter configuração do item
        config = item_config[tipo_item_slug]
        model_class = config['model']
        name_fields = config['name_fields']
        display_name = config['display_name']
        
        # Buscar item
        item = get_object_or_404(model_class, id=item_id)
        
        # Construir nome do item antes de excluir
        item_name = ' '.join(getattr(item, field, '') for field in name_fields)
        item_data = {
            'id': item.id,
            'tipo': tipo_item_slug,
            'nome': item_name,
            'display_name': display_name
        }
        
        # Excluir item
        item.delete()
        
        return JsonResponse(
            build_response_data(
                True,
                message=f'{display_name} {item_name} foi excluído permanentemente',
                data=item_data
            )
        )
        
    except Exception as e:
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

# Views para API
@require_GET
@login_required
def api_get_ilhas_por_sala(request, sala_id):
    ilhas = list(Ilha.objects.filter(sala_id=sala_id).values('id', 'nome', 'quantidade_pas'))
    return JsonResponse({'ilhas': ilhas})

@require_GET
@login_required
def api_get_ilha_info(request, ilha_id):
    """
    API GET para obter informações detalhadas de uma ilha.
    
    Args:
        request: HttpRequest
        ilha_id: ID da ilha
    
    Returns:
        JsonResponse com informações da ilha e estatísticas de PAs
    """
    try:
        # Buscar ilha
        try:
            ilha = get_object_or_404(Ilha, id=ilha_id)
        except Exception:
            return JsonResponse(
                build_response_data(False, error='Ilha não encontrada'),
                status=404
            )
        
        # Calcular estatísticas de PAs (usando função existente se disponível)
        try:
            pas_stats = _calculate_pas_statistics(ilha)
        except NameError:
            # Se a função não existir, calcular manualmente
            pas_total = PosicaoAtendimento.objects.filter(ilha=ilha).count()
            pas_stats = {
                'existentes': pas_total,
                'disponiveis': ilha.quantidade_pas - pas_total if ilha.quantidade_pas > pas_total else 0
            }
        
        # Preparar dados da resposta
        response_data = {
            'ilha': {
                'id': ilha.id,
                'nome': ilha.nome,
                'quantidade_pas': ilha.quantidade_pas,
                'sala': {
                    'id': ilha.sala.id,
                    'nome': ilha.sala.nome
                } if ilha.sala else None
            },
            'estatisticas_pas': pas_stats,
            'capacidade_utilizada': {
                'percentual': round((pas_stats['existentes'] / ilha.quantidade_pas) * 100, 2) if ilha.quantidade_pas > 0 else 0,
                'status': 'completa' if pas_stats.get('disponiveis', 0) == 0 else 'disponivel'
            }
        }
        
        return JsonResponse(
            build_response_data(True, data=response_data)
        )
        
    except Exception as e:
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

@require_POST
@login_required
def api_post_atualizar_status_pa(request):
    """
    API POST para atualizar o status de uma Posição de Atendimento.
    
    Args:
        request: HttpRequest com dados JSON contendo pa_id e novo_status
    
    Returns:
        JsonResponse com resultado da operação
    """
    try:
        # Validar e extrair dados da requisição
        request_data = _extract_json_data(request)
        if not request_data['success']:
            return request_data['response']
        
        data = request_data['data']
        pa_id = data.get('pa_id')
        novo_status = data.get('status')
        
        # Validar dados obrigatórios
        validation_result = _validate_required_fields(
            {'pa_id': pa_id, 'status': novo_status},
            {'pa_id': 'ID da PA', 'status': 'Status'}
        )
        if not validation_result['success']:
            return validation_result['response']
        
        # Buscar PA
        try:
            pa = PosicaoAtendimento.objects.get(id=pa_id)
        except PosicaoAtendimento.DoesNotExist:
            return gerar_resposta_api(
                False, 
                error='Posição de Atendimento não encontrada', 
                status=404
            )
        
        # Validar status
        status_validation = _validate_pa_status(novo_status)
        if not status_validation['success']:
            return status_validation['response']
        
        # Atualizar status
        pa.status = novo_status
        pa.save()
        
        # Preparar dados de resposta
        response_data = {
            'pa': {
                'id': pa.id,
                'status': pa.status,
                'status_display': pa.get_status_display() if hasattr(pa, 'get_status_display') else novo_status,
                'nome': getattr(pa, 'nome', f'PA {pa.id}'),
                'ilha': pa.ilha.nome if pa.ilha else None,
                'sala': pa.sala.nome if pa.sala else None
            },
            'timestamp': timezone.now().isoformat()
        }
        
        return gerar_resposta_api(
            True,
            message=f'Status da PA atualizado para {novo_status}',
            data=response_data
        )
        
    except Exception as e:
        return gerar_resposta_api(False, error=f'Erro interno: {str(e)}', status=500)

# Funções auxiliares para as APIs refatoradas

def _extract_json_data(request):
    """
    Extrai e valida dados JSON da requisição.
    
    Args:
        request: HttpRequest
    
    Returns:
        dict: {'success': bool, 'data': dict, 'response': JsonResponse}
    """
    try:
        data = json.loads(request.body)
        return {
            'success': True,
            'data': data,
            'response': None
        }
    except json.JSONDecodeError:
        return {
            'success': False,
            'data': None,
            'response': gerar_resposta_api(False, error='Dados JSON inválidos', status=400)
        }
    except Exception as e:
        return {
            'success': False,
            'data': None,
            'response': gerar_resposta_api(False, error=f'Erro ao processar dados: {str(e)}', status=400)
        }

def _validate_required_fields(fields_data, field_labels):
    """
    Valida se os campos obrigatórios estão presentes.
    
    Args:
        fields_data: dict com os dados dos campos
        field_labels: dict com os rótulos dos campos para mensagens de erro
    
    Returns:
        dict: {'success': bool, 'response': JsonResponse}
    """
    missing_fields = []
    
    for field_key, field_value in fields_data.items():
        if not field_value:
            field_label = field_labels.get(field_key, field_key)
            missing_fields.append(field_label)
    
    if missing_fields:
        error_message = f"Campos obrigatórios não fornecidos: {', '.join(missing_fields)}"
        return {
            'success': False,
            'response': gerar_resposta_api(False, error=error_message, status=400)
        }
    
    return {'success': True, 'response': None}

def _get_objects_for_computador_pa(pa_id, computador_id):
    """
    Busca e valida objetos PA e Computador.
    
    Args:
        pa_id: ID da posição de atendimento
        computador_id: ID do computador
    
    Returns:
        dict: {'success': bool, 'pa': PA, 'computador': Computador, 'response': JsonResponse}
    """
    try:
        pa = get_object_or_404(PosicaoAtendimento, pk=pa_id)
    except PosicaoAtendimento.DoesNotExist:
        return {
            'success': False,
            'pa': None,
            'computador': None,
            'response': gerar_resposta_api(False, error='PA não encontrada', status=404)
        }
    
    try:
        computador = get_object_or_404(Computador, pk=computador_id)
    except Computador.DoesNotExist:
        return {
            'success': False,
            'pa': None,
            'computador': None,
            'response': gerar_resposta_api(False, error='Computador não encontrado', status=404)
        }
    
    return {
        'success': True,
        'pa': pa,
        'computador': computador,
        'response': None
    }

def _extract_filter_params(request, allowed_params):
    """
    Extrai parâmetros de filtro da query string.
    
    Args:
        request: HttpRequest
        allowed_params: lista de parâmetros permitidos
    
    Returns:
        dict: parâmetros extraídos
    """
    filters = {}
    for param in allowed_params:
        value = request.GET.get(param)
        if value:
            filters[param] = value
    return filters

def _serialize_perifericos_list(perifericos_queryset):
    """
    Serializa uma queryset de periféricos para JSON.
    
    Args:
        perifericos_queryset: QuerySet de periféricos
    
    Returns:
        list: lista de dicionários com dados dos periféricos
    """
    return [
        {
            'id': p.id,
            'marca': p.marca,
            'modelo': p.modelo,
            'tipo_nome': p.tipo.nome,
            'status': p.status,
            'quantidade': getattr(p, 'quantidade', 1)
        } for p in perifericos_queryset
    ]

def _calculate_pas_statistics(ilha):
    """
    Calcula estatísticas de PAs para uma ilha.
    
    Args:
        ilha: objeto Ilha
    
    Returns:
        dict: estatísticas das PAs
    """
    pas_existentes = PosicaoAtendimento.objects.filter(ilha=ilha).count()
    pas_disponiveis = max(0, ilha.quantidade_pas - pas_existentes)
    
    return {
        'existentes': pas_existentes,
        'disponiveis': pas_disponiveis,
        'total_configurado': ilha.quantidade_pas
    }

def _validate_pa_status(status):
    """
    Valida se o status da PA é válido.
    
    Args:
        status: string do status
    
    Returns:
        dict: {'success': bool, 'response': JsonResponse}
    """
    # Obter status válidos do modelo (assumindo que existe choices no modelo)
    try:
        valid_statuses = [choice[0] for choice in PosicaoAtendimento._meta.get_field('status').choices]
        if status not in valid_statuses:
            return {
                'success': False,
                'response': gerar_resposta_api(
                    False, 
                    error=f'Status inválido. Valores válidos: {", ".join(valid_statuses)}', 
                    status=400
                )
            }
    except AttributeError:
        # Se não houver choices definidas, aceitar qualquer status
        pass
    
    return {'success': True, 'response': None}

def _extrair_dados_status_pa(request):
    """Extrai dados da requisição para atualização de status da PA"""
    if request.content_type == 'application/json':
        data = json.loads(request.body)
        return data.get('pa_id'), data.get('status')
    else:
        return request.POST.get('pa_id'), request.POST.get('status')


def _serialize_pas_for_atribuicao(posicoes_queryset):
    """
    Serializa queryset de PAs para atribuição de periféricos.
    
    Args:
        posicoes_queryset: QuerySet de PosicaoAtendimento
    
    Returns:
        list: Lista de dicionários com dados dos PAs
    """
    pas_data = []
    for pa in posicoes_queryset:
        pa_dict = {
            'id': pa.id,
            'numero': pa.numero,
            'texto': f"{pa.sala.nome} - {pa.ilha.nome} - PA {pa.numero}",
            'sala': {
                'id': pa.sala.id,
                'nome': pa.sala.nome
            },
            'ilha': {
                'id': pa.ilha.id,
                'nome': pa.ilha.nome
            },
            'status': pa.status if hasattr(pa, 'status') else 'ativo'
        }
        pas_data.append(pa_dict)
    return pas_data


def _serialize_funcionarios_list(funcionarios_queryset):
    """
    Serializa queryset de funcionários.
    
    Args:
        funcionarios_queryset: QuerySet de Funcionario
    
    Returns:
        list: Lista de dicionários com dados dos funcionários
    """
    funcionarios_data = []
    for funcionario in funcionarios_queryset:
        funcionario_dict = {
            'id': funcionario.id,
            'nome_completo': funcionario.nome_completo,
            'email': funcionario.email if hasattr(funcionario, 'email') else '',
            'empresa': {
                'id': funcionario.empresa.id,
                'nome': funcionario.empresa.nome
            } if funcionario.empresa else None,
            'cargo': {
                'id': funcionario.cargo.id,
                'nome': funcionario.cargo.nome
            } if funcionario.cargo else None,
            'ativo': funcionario.ativo if hasattr(funcionario, 'ativo') else True
        }
        funcionarios_data.append(funcionario_dict)
    return funcionarios_data


@login_required
def storm_create(request):
    """View para criar um novo registro Storm"""
    if request.method == 'POST':
        form = StormForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Storm cadastrado com sucesso!')
            return redirect('ti:admin')
        else:
            messages.error(request, 'Erro ao cadastrar Storm. Verifique os dados informados.')
    else:
        form = StormForm()
    
    context = {
        'title': 'Cadastrar Storm',
        'form': form,
        'funcionarios_list': Funcionario.objects.filter(status=True).order_by('nome_completo'),
    }
    
    return render(request, 'ti/admin.html', context)


@login_required
def sistema_create(request):
    """View para criar um novo registro Sistema"""
    if request.method == 'POST':
        form = SistemaForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Sistema cadastrado com sucesso!')
            return redirect('ti:admin')
        else:
            messages.error(request, 'Erro ao cadastrar Sistema. Verifique os dados informados.')
    else:
        form = SistemaForm()
    
    context = {
        'title': 'Cadastrar Sistema',
        'form': form,
        'funcionarios_list': Funcionario.objects.filter(status=True).order_by('nome_completo'),
    }
    
    return render(request, 'ti/admin.html', context)

@login_required
def storm_update(request, pk):
    """View para editar um registro Storm"""
    storm = get_object_or_404(Storm, pk=pk)
    if request.method == 'POST':
        form = StormForm(request.POST, instance=storm)
        if form.is_valid():
            form.save()
            messages.success(request, 'Storm atualizado com sucesso!')
            return redirect('ti:controle_acessos')
        else:
            messages.error(request, 'Erro ao atualizar Storm. Verifique os dados informados.')
    else:
        form = StormForm(instance=storm)
    
    context = {
        'title': 'Editar Storm',
        'form': form,
        'funcionarios_list': Funcionario.objects.filter(status=True).order_by('nome_completo'),
        'storm': storm,
    }
    
    return render(request, 'ti/admin.html', context)

@login_required
def storm_delete(request, pk):
    """View para excluir um registro Storm"""
    storm = get_object_or_404(Storm, pk=pk)
    if request.method == 'POST':
        storm.delete()
        messages.success(request, 'Storm excluído com sucesso!')
        return redirect('ti:controle_acessos')
    
    context = {
        'title': 'Excluir Storm',
        'storm': storm,
    }
    
    return render(request, 'ti/confirm_delete.html', context)

@login_required
def sistema_update(request, pk):
    """View para editar um registro Sistema"""
    sistema = get_object_or_404(Sistema, pk=pk)
    if request.method == 'POST':
        form = SistemaForm(request.POST, instance=sistema)
        if form.is_valid():
            form.save()
            messages.success(request, 'Sistema atualizado com sucesso!')
            return redirect('ti:controle_acessos')
        else:
            messages.error(request, 'Erro ao atualizar Sistema. Verifique os dados informados.')
    else:
        form = SistemaForm(instance=sistema)
    
    context = {
        'title': 'Editar Sistema',
        'form': form,
        'funcionarios_list': Funcionario.objects.filter(status=True).order_by('nome_completo'),
        'sistema': sistema,
    }
    
    return render(request, 'ti/admin.html', context)

@login_required
def sistema_delete(request, pk):
    """View para excluir um registro Sistema"""
    sistema = get_object_or_404(Sistema, pk=pk)
    if request.method == 'POST':
        sistema.delete()
        messages.success(request, 'Sistema excluído com sucesso!')
        return redirect('ti:controle_acessos')
    
    context = {
        'title': 'Excluir Sistema',
        'sistema': sistema,
    }
    
    return render(request, 'ti/confirm_delete.html', context)

@login_required
def api_post_remover_periferico_pa(request):
    """
    API POST para remover periférico de uma posição de atendimento.
    
    Args:
        request: HttpRequest com dados JSON contendo periferico_id e pa_id
    
    Returns:
        JsonResponse com resultado da operação
    """
    if request.method != 'POST':
        return JsonResponse(
            build_response_data(False, error='Método não permitido'),
            status=405
        )
    
    try:
        # Extrair dados JSON
        json_result = extract_json_data(request)
        if not json_result['success']:
            return JsonResponse(
                build_response_data(False, error=json_result['error']),
                status=400
            )
        
        data = json_result['data']
        
        # Validar campos obrigatórios
        required_fields = {
            'periferico_id': 'ID do periférico',
            'pa_id': 'ID da posição de atendimento'
        }
        
        validation_result = validate_required_fields(data, required_fields)
        if not validation_result['success']:
            return JsonResponse(
                build_response_data(False, error=validation_result['error']),
                status=400
            )
        
        periferico_id = data['periferico_id']
        pa_id = data['pa_id']
        
        # Buscar atribuição ativa
        try:
            atribuicao = AtribuicaoPerifericoPA.objects.get(
                periferico_id=periferico_id,
                posicao_atendimento_id=pa_id,
                ativo=True
            )
        except AtribuicaoPerifericoPA.DoesNotExist:
            return JsonResponse(
                build_response_data(
                    False,
                    error='Atribuição não encontrada ou já removida'
                ),
                status=404
            )
        
        # Buscar periférico para obter informações
        periferico = get_object_or_404(Periferico, id=periferico_id)
        pa = get_object_or_404(PosicaoAtendimento, id=pa_id)
        
        # Desativar a atribuição
        atribuicao.ativo = False
        atribuicao.data_remocao = timezone.now()
        atribuicao.save()
        
        # Atualizar status do periférico
        periferico.status = 'disponivel'
        periferico.save()
        
        # Dados da resposta
        response_data = {
            'atribuicao_id': atribuicao.id,
            'periferico': {
                'id': periferico.id,
                'tipo': periferico.tipo.nome,
                'marca': periferico.marca,
                'modelo': periferico.modelo,
                'status': periferico.status
            },
            'posicao_atendimento': {
                'id': pa.id,
                'numero': pa.numero,
                'sala': pa.sala.nome if pa.sala else None
            },
            'data_remocao': atribuicao.data_remocao.isoformat()
        }
        
        return JsonResponse(
            build_response_data(
                True,
                message='Periférico removido da PA com sucesso',
                data=response_data
            )
        )
        
    except Exception as e:
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

@require_GET
@login_required
def api_get_controle_salas(request):
    # Implementação básica - retorna dados necessários para a página de controle de salas
    salas = list(Sala.objects.values('id', 'nome'))
    ilhas = list(Ilha.objects.values('id', 'nome', 'sala_id'))
    posicoes = list(PosicaoAtendimento.objects.values('id', 'numero', 'ilha_id', 'status'))
    
    return JsonResponse({
        'salas': salas,
        'ilhas': ilhas,
        'posicoes': posicoes
    })


# Views para Salas
@login_required
def sala_list(request):
    salas = Sala.objects.all().select_related('loja')
    context = {
        'salas': salas
    }
    return render(request, 'ti/controle_salas.html', context)

@login_required
def sala_create(request):
    if request.method == 'POST':
        form = SalaForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Sala cadastrada com sucesso!')
            return redirect('ti:admin')
    else:
        form = SalaForm()
    
    context = {
        'form': form,
        'lojas_list': Loja.objects.filter(status=True).order_by('nome'),
    }
    return render(request, 'ti/admin.html', context)

@login_required
def sala_update(request, pk):
    sala = get_object_or_404(Sala, pk=pk)
    if request.method == 'POST':
        form = SalaForm(request.POST, instance=sala)
        if form.is_valid():
            form.save()
            messages.success(request, 'Sala atualizada com sucesso!')
            return redirect('ti:sala_list')
    else:
        form = SalaForm(instance=sala)
    
    context = {
        'form': form,
        'sala': sala,
        'lojas_list': Loja.objects.filter(status=True).order_by('nome'),
    }
    return render(request, 'ti/sala_form.html', context)

@login_required
def sala_delete(request, pk):
    sala = get_object_or_404(Sala, pk=pk)
    if request.method == 'POST':
        sala.delete()
        messages.success(request, 'Sala excluída com sucesso!')
        return redirect('ti:sala_list')
    
    context = {
        'title': 'Excluir Sala',
        'objeto': sala
    }
    return render(request, 'ti/confirm_delete.html', context)


# Views para Ilhas
@login_required
def ilha_list(request):
    ilhas = Ilha.objects.all().select_related('sala', 'sala__loja')
    context = {
        'ilhas': ilhas
    }
    return render(request, 'ti/controle_salas.html', context)

@login_required
def ilha_create(request):
    if request.method == 'POST':
        form = IlhaForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Ilha cadastrada com sucesso!')
            return redirect('ti:admin')
    else:
        form = IlhaForm()
    
    context = {
        'form': form,
        'salas_list': Sala.objects.all().select_related('loja'),
        'lojas_list': Loja.objects.filter(status=True).order_by('nome'),
    }
    return render(request, 'apps/ti/admin.html', context)

@login_required
def ilha_update(request, pk):
    ilha = get_object_or_404(Ilha, pk=pk)
    if request.method == 'POST':
        form = IlhaForm(request.POST, instance=ilha)
        if form.is_valid():
            form.save()
            messages.success(request, 'Ilha atualizada com sucesso!')
            return redirect('ti:ilha_list')
    else:
        form = IlhaForm(instance=ilha)
    
    context = {
        'form': form,
        'ilha': ilha,
        'salas_list': Sala.objects.all().select_related('loja'),
        'lojas_list': Loja.objects.filter(status=True).order_by('nome'),
    }
    return render(request, 'ti/ilha_form.html', context)

@login_required
def ilha_delete(request, pk):
    ilha = get_object_or_404(Ilha, pk=pk)
    if request.method == 'POST':
        ilha.delete()
        messages.success(request, 'Ilha excluída com sucesso!')
        return redirect('ti:ilha_list')
    
    context = {
        'title': 'Excluir Ilha',
        'objeto': ilha
    }
    return render(request, 'ti/confirm_delete.html', context)


# Views para Posições de Atendimento
@login_required
def posicao_atendimento_list(request):
    posicoes = PosicaoAtendimento.objects.all().select_related('sala', 'ilha')
    context = {
        'posicoes': posicoes
    }
    return render(request, 'ti/controle_salas.html', context)

@login_required
def posicao_atendimento_create(request):
    if request.method == 'POST':
        form = PosicaoAtendimentoForm(request.POST)
        if form.is_valid():
            # Obter a quantidade de PAs a serem criadas
            quantidade_pas = form.cleaned_data.get('quantidade_pas', 1)
            
            # Dados base da primeira PA
            pa_base = form.save(commit=False)
            
            pas_criadas = []
            for i in range(quantidade_pas):
                # Criar nova instância para cada PA (exceto a primeira)
                if i == 0:
                    pa = pa_base
                else:
                    pa = PosicaoAtendimento(
                        titulo=pa_base.titulo,
                        ilha=pa_base.ilha,
                        sala=pa_base.sala,
                        status=pa_base.status,
                        observacoes=pa_base.observacoes
                    )
                
                # Não definir número manualmente - deixar o model.save() gerar automaticamente
                pa.numero = None
                pa.save()
                pas_criadas.append(pa)
            
            # Mensagem de sucesso
            if quantidade_pas == 1:
                messages.success(request, f'PA {pas_criadas[0].numero} cadastrada com sucesso!')
            else:
                numeros_pas = [pa.numero for pa in pas_criadas]
                messages.success(request, f'{quantidade_pas} PAs cadastradas com sucesso: {", ".join(numeros_pas)}')
            
            return redirect('ti:admin')
    else:
        form = PosicaoAtendimentoForm()
    
    context = {
        'form': form,
        'salas_list': Sala.objects.all().select_related('loja'),
        'lojas_list': Loja.objects.filter(status=True).order_by('nome'),
    }
    return render(request, 'apps/ti/admin.html', context)

@login_required
def posicao_atendimento_update(request, pk):
    posicao_atendimento = get_object_or_404(PosicaoAtendimento, pk=pk)
    if request.method == 'POST':
        form = PosicaoAtendimentoForm(request.POST, instance=posicao_atendimento)
        if form.is_valid():
            form.save()
            messages.success(request, 'Posição de atendimento atualizada com sucesso!')
            return redirect('ti:posicao_atendimento_list')
    else:
        form = PosicaoAtendimentoForm(instance=posicao_atendimento)
    
    context = {
        'form': form,
        'posicao_atendimento': posicao_atendimento,
        'salas_list': Sala.objects.all().select_related('loja'),
        'lojas_list': Loja.objects.filter(status=True).order_by('nome'),
    }
    return render(request, 'ti/posicao_atendimento_form.html', context)

@login_required
def posicao_atendimento_delete(request, pk):
    posicao = get_object_or_404(PosicaoAtendimento, pk=pk)
    if request.method == 'POST':
        posicao.delete()
        messages.success(request, 'Posição de atendimento excluída com sucesso!')
        return redirect('ti:posicao_atendimento_list')
    
    context = {
        'title': 'Excluir Posição de Atendimento',
        'objeto': posicao
    }
    return render(request, 'ti/confirm_delete.html', context)


# Views para Atribuição de Funcionários a PAs
@login_required
def atribuicao_funcionario_pa_list(request):
    atribuicoes = AtribuicaoFuncionarioPA.objects.all().select_related('funcionario', 'posicao_atendimento', 'posicao_atendimento__sala', 'posicao_atendimento__ilha')
    context = {
        'atribuicoes': atribuicoes
    }
    return render(request, 'ti/controle_salas.html', context)

@login_required
def atribuicao_funcionario_pa_create(request):
    if request.method == 'POST':
        form = AtribuicaoFuncionarioPAForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Atribuição de funcionário cadastrada com sucesso!')
            return redirect('ti:admin')
    else:
        form = AtribuicaoFuncionarioPAForm()
    
    context = {
        'form': form
    }
    return render(request, 'ti/admin.html', context)

@login_required
def atribuicao_funcionario_pa_update(request, pk):
    atribuicao = get_object_or_404(AtribuicaoFuncionarioPA, pk=pk)
    if request.method == 'POST':
        form = AtribuicaoFuncionarioPAForm(request.POST, instance=atribuicao)
        if form.is_valid():
            form.save()
            messages.success(request, 'Atribuição de funcionário atualizada com sucesso!')
            return redirect('ti:atribuicao_funcionario_pa_list')
    else:
        form = AtribuicaoFuncionarioPAForm(instance=atribuicao)
    
    context = {
        'form': form,
        'atribuicao': atribuicao
    }
    return render(request, 'apps/ti/admin.html', context)


# Views para Periféricos
@login_required
def periferico_list(request):
    perifericos = Periferico.objects.all().select_related('tipo')
    context = {
        'perifericos': perifericos
    }
    return render(request, 'apps/ti/controle_estoque.html', context)

@login_required
def periferico_create(request):
    if request.method == 'POST':
        # Verificar se é um envio em lote
        if 'perifericos_lote' in request.POST:
            try:
                perifericos_lote = json.loads(request.POST.get('perifericos_lote', '[]'))
                if not perifericos_lote:
                    messages.warning(request, 'Nenhum periférico para cadastrar.')
                    return redirect('ti:admin')
                
                # Contadores para feedback
                total_cadastrados = 0
                erros = []
                
                # Processar cada periférico do lote
                for item in perifericos_lote:
                    try:
                        # Criar cada periférico com base nos dados do lote
                        tipo_id = item.get('tipo_id')
                        marca = item.get('marca', '').strip()
                        modelo = item.get('modelo', '').strip()
                        data_aquisicao = item.get('data_aquisicao')
                        loja_id = item.get('loja_id')
                        quantidade = item.get('quantidade', 1)
                        
                        # Validar dados obrigatórios
                        if not (tipo_id and marca and modelo and loja_id):
                            erros.append(f"Dados incompletos para periférico: {marca} {modelo}")
                            continue
                        
                        # Converter data se necessário
                        if data_aquisicao:
                            try:
                                data_aquisicao = timezone.datetime.strptime(data_aquisicao, '%Y-%m-%d').date()
                            except (ValueError, TypeError):
                                data_aquisicao = None
                        
                        # Criar periférico(s)
                        # Para cada item do lote, criamos a quantidade especificada (cada unidade com quantidade=1)
                        for _ in range(quantidade):
                            periferico = Periferico(
                                tipo_id=tipo_id,
                                marca=marca,
                                modelo=modelo,
                                data_aquisicao=data_aquisicao,
                                loja_id=loja_id,
                                quantidade=1,  # Cada periférico tem quantidade=1 para melhor controle
                                status='disponivel'
                            )
                            periferico.save()
                            total_cadastrados += 1
                    except Exception as e:
                        erros.append(f"Erro ao cadastrar {marca} {modelo}: {str(e)}")
                
                # Feedback para o usuário
                if total_cadastrados > 0:
                    if total_cadastrados == 1:
                        messages.success(request, f'1 periférico cadastrado com sucesso!')
                    else:
                        messages.success(request, f'{total_cadastrados} periféricos cadastrados com sucesso!')
                
                if erros:
                    for erro in erros[:5]:  # Limitar a quantidade de erros exibidos
                        messages.error(request, erro)
                    
                    if len(erros) > 5:
                        messages.error(request, f'...e mais {len(erros) - 5} erros.')
                
                return redirect('ti:admin')
            
            except json.JSONDecodeError:
                messages.error(request, 'Formato de dados inválido para cadastro em lote.')
                return redirect('ti:admin')
            
        # Processo normal (formulário individual)
        form = PerifericoForm(request.POST)
        if form.is_valid():
            # Obter a quantidade a ser criada
            quantidade = form.cleaned_data.get('quantidade', 1)
            
            # Limitar a quantidade para evitar sobrecarga (opcional)
            quantidade = min(quantidade, 100)  # Máximo de 100 periféricos por vez
            
            if quantidade > 1:
                # Se a quantidade for maior que 1, criar múltiplos periféricos
                perif_criados = 0
                modelo_base = form.save(commit=False)  # Não salvar ainda
                
                # Salvar as informações originais
                tipo = modelo_base.tipo
                marca = modelo_base.marca
                modelo = modelo_base.modelo
                data_aquisicao = modelo_base.data_aquisicao
                loja = modelo_base.loja
                status = modelo_base.status
                observacoes = modelo_base.observacoes
                
                # Definir quantidade como 1 para cada periférico individual
                modelo_base.quantidade = 1
                modelo_base.save()
                perif_criados += 1
                
                # Criar os periféricos adicionais
                for _ in range(1, quantidade):
                    periferico = Periferico(
                        tipo=tipo,
                        marca=marca,
                        modelo=modelo,
                        data_aquisicao=data_aquisicao,
                        quantidade=1,  # Cada periférico terá quantidade 1
                        loja=loja,
                        status=status,
                        observacoes=observacoes
                    )
                    periferico.save()
                    perif_criados += 1
                
                messages.success(request, f'{perif_criados} periféricos cadastrados com sucesso!')
            else:
                # Se quantidade for 1, salvar normalmente
                form.save()
                messages.success(request, 'Periférico cadastrado com sucesso!')
            
            return redirect('ti:admin')
    else:
        form = PerifericoForm()
    
    context = {
        'form': form,
        'title': 'Cadastrar Novo Periférico'
    }
    return render(request, 'apps/ti/admin.html', context)

@login_required
def periferico_update(request, pk):
    periferico = get_object_or_404(Periferico, pk=pk)
    if request.method == 'POST':
        form = PerifericoForm(request.POST, instance=periferico)
        if form.is_valid():
            form.save()
            messages.success(request, 'Periférico atualizado com sucesso!')
            return redirect('ti:periferico_list')
    else:
        form = PerifericoForm(instance=periferico)
    
    context = {
        'form': form,
        'periferico': periferico
    }
    return render(request, 'apps/ti/admin.html', context)

@login_required
def periferico_delete(request, pk):
    periferico = get_object_or_404(Periferico, pk=pk)
    if request.method == 'POST':
        periferico.delete()
        messages.success(request, 'Periférico excluído com sucesso!')
        return redirect('ti:periferico_list')
    
    context = {
        'title': 'Excluir Periférico',
        'objeto': periferico
    }
    return render(request, 'ti/confirm_delete.html', context)

# Funções que faltavam para gerenciar atribuições
@login_required
def atribuicao_funcionario_pa_delete(request, pk):
    atribuicao = get_object_or_404(AtribuicaoFuncionarioPA, pk=pk)
    if request.method == 'POST':
        atribuicao.delete()
        messages.success(request, 'Atribuição de funcionário excluída com sucesso!')
        return redirect('ti:atribuicao_funcionario_pa_list')
    
    context = {
        'title': 'Excluir Atribuição de Funcionário',
        'objeto': atribuicao
    }
    return render(request, 'ti/confirm_delete.html', context)

# Views para Atribuição de Periféricos a PAs
@login_required
def atribuicao_periferico(request):
    # Lógica para a página de atribuição de periféricos
    context = {}
    return render(request, 'apps/ti/controle_salas.html', context)

@login_required
def atribuicao_periferico_pa_create(request):
    if request.method == 'POST':
        form = AtribuicaoPerifericoPAForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Atribuição de periférico cadastrada com sucesso!')
            return redirect('ti:admin')
    else:
        form = AtribuicaoPerifericoPAForm()
    
    context = {
        'form': form
    }
    return render(request, 'apps/ti/admin.html', context)

@login_required
def atribuicao_periferico_pa_update(request, pk):
    atribuicao = get_object_or_404(AtribuicaoPerifericoPA, pk=pk)
    if request.method == 'POST':
        form = AtribuicaoPerifericoPAForm(request.POST, instance=atribuicao)
        if form.is_valid():
            form.save()
            messages.success(request, 'Atribuição de periférico atualizada com sucesso!')
            return redirect('ti:admin')
    else:
        form = AtribuicaoPerifericoPAForm(instance=atribuicao)
    
    context = {
        'form': form,
        'atribuicao': atribuicao
    }
    return render(request, 'apps/ti/admin.html', context)

@login_required
def atribuicao_periferico_pa_delete(request, pk):
    atribuicao = get_object_or_404(AtribuicaoPerifericoPA, pk=pk)
    if request.method == 'POST':
        atribuicao.delete()
        messages.success(request, 'Atribuição de periférico excluída com sucesso!')
        return redirect('ti:admin')
    
    context = {
        'title': 'Excluir Atribuição de Periférico',
        'objeto': atribuicao
    }
    return render(request, 'apps/ti/confirm_delete.html', context)

# Funções de API
@require_GET
@login_required
def api_get_pas_para_atribuicao_periferico(request, periferico_id):
    """
    API GET para obter PAs disponíveis para atribuição de periférico.
    
    Args:
        request: HttpRequest
        periferico_id: ID do periférico
    
    Returns:
        JsonResponse com lista de PAs disponíveis
    """
    try:
        # Verificar se o periférico existe
        periferico = get_object_or_404(Periferico, pk=periferico_id)
        
        # Extrair filtros opcionais
        filtros = _extract_filter_params(request, ['loja', 'sala', 'status'])
        
        # Construir filtros para PAs
        pa_filters = {}
        if filtros.get('loja'):
            try:
                loja_id = int(filtros['loja'])
                pa_filters['sala__loja_id'] = loja_id
            except (ValueError, TypeError):
                return gerar_resposta_api(False, error='ID da loja inválido', status=400)
        
        if filtros.get('sala'):
            try:
                sala_id = int(filtros['sala'])
                pa_filters['sala_id'] = sala_id
            except (ValueError, TypeError):
                return gerar_resposta_api(False, error='ID da sala inválido', status=400)
        
        if filtros.get('status'):
            pa_filters['status'] = filtros['status']
        
        # Buscar PAs disponíveis
        posicoes_queryset = PosicaoAtendimento.objects.filter(
            **pa_filters
        ).select_related('sala', 'ilha').order_by('sala__nome', 'ilha__nome', 'numero')
        
        # Serializar dados
        pas_data = _serialize_pas_for_atribuicao(posicoes_queryset)
        
        # Preparar resposta
        response_data = {
            'periferico': {
                'id': periferico.id,
                'marca': periferico.marca,
                'modelo': periferico.modelo,
                'tipo': periferico.tipo.nome
            },
            'pas_disponiveis': pas_data,
            'total': len(pas_data),
            'filtros_aplicados': filtros
        }
        
        return gerar_resposta_api(True, data=response_data)
        
    except Periferico.DoesNotExist:
        return gerar_resposta_api(False, error='Periférico não encontrado', status=404)
    except Exception as e:
        return gerar_resposta_api(False, error=f'Erro interno: {str(e)}', status=500)



@require_GET
@login_required
def api_get_funcionarios(request):
    """
    API GET para obter a lista de funcionários para uso em dropdowns.
    Considera filtro por loja se especificado.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info("[DEBUG] api_funcionarios chamada")
    logger.info(f"[DEBUG] Method: {request.method}, Content-Type: {request.content_type if hasattr(request, 'content_type') else 'N/A'}")
    
    try:
        # Obter a loja selecionada, se houver
        loja_id = request.GET.get('loja')
        
        # Obter todos os funcionários ativos
        logger.info("[DEBUG] Buscando funcionários ativos...")
        try:
            funcionarios = Funcionario.objects.filter(status=True).select_related('empresa', 'setor')
            logger.info(f"[DEBUG] Query executada com sucesso. Funcionários encontrados: {funcionarios.count()}")
        except Exception as query_error:
            logger.error(f"[DEBUG] Erro na query de funcionários: {str(query_error)}")
            raise
        
        # Aplicar filtro de loja se necessário
        if loja_id:
            try:
                loja_selecionada = int(loja_id)
                funcionarios = funcionarios.filter(empresa__lojas__id=loja_selecionada)
                logger.info(f"[DEBUG] Filtro aplicado para loja: {loja_selecionada}")
            except (ValueError, TypeError):
                logger.warning(f"[DEBUG] ID de loja inválido: {loja_id}")
        
        funcionarios = funcionarios.order_by('nome_completo')
        logger.info(f"[DEBUG] Total de funcionários encontrados: {funcionarios.count()}")
        
        # Construir a lista de funcionários de forma simples e robusta
        lista_funcionarios = []
        for funcionario in funcionarios:
            try:
                funcionario_info = {
                    'id': funcionario.id,
                    'nome_completo': funcionario.nome_completo or 'Nome não informado',
                }
                lista_funcionarios.append(funcionario_info)
                logger.debug(f"[DEBUG] Funcionário processado: {funcionario.id} - {funcionario.nome_completo}")
            except Exception as func_error:
                logger.warning(f"[DEBUG] Erro ao processar funcionário {funcionario.id}: {str(func_error)}")
                continue
        
        logger.info(f"[DEBUG] Lista de funcionários processada com sucesso, total: {len(lista_funcionarios)}")
        return JsonResponse({
            'success': True,
            'funcionarios': lista_funcionarios
        })
    except Exception as e:
        logger.error(f"[DEBUG] Erro ao processar funcionários: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@login_required
def api_post_atribuir_funcionario_pa(request):
    """
    API POST para atribuir ou remover funcionário de uma posição de atendimento.
    
    Args:
        request: HttpRequest com dados JSON contendo pa_id e funcionario_id (opcional)
    
    Returns:
        JsonResponse com resultado da operação
    """
    if request.method != 'POST':
        return JsonResponse(
            build_response_data(False, error='Método não permitido'),
            status=405
        )
    
    try:
        # Extrair dados JSON
        json_result = extract_json_data(request)
        if not json_result['success']:
            return JsonResponse(
                build_response_data(False, error=json_result['error']),
                status=400
            )
        
        data = json_result['data']
        
        # Validar campos obrigatórios
        required_fields = {
            'pa_id': 'ID da posição de atendimento'
        }
        
        validation_result = validate_required_fields(data, required_fields)
        if not validation_result['success']:
            return JsonResponse(
                build_response_data(False, error=validation_result['error']),
                status=400
            )
        
        pa_id = data['pa_id']
        funcionario_id = data.get('funcionario_id')  # Opcional - None para remover
        
        # Obter a posição de atendimento
        pa = get_object_or_404(PosicaoAtendimento, id=pa_id)
        
        # Configuração de operação
        operation_config = {
            'assign': {
                'status_pa': 'ocupada',
                'message_template': 'Funcionário {funcionario} atribuído à PA {pa} com sucesso'
            },
            'remove': {
                'status_pa': 'livre',
                'message_template': 'Funcionário removido da PA {pa} com sucesso'
            }
        }
        
        # Lista para rastrear PAs afetadas
        pas_afetadas = []
        
        if funcionario_id:
            # Operação de atribuição
            funcionario = get_object_or_404(Funcionario, id=funcionario_id)
            config = operation_config['assign']
                
            # Verificar se este funcionário já está atribuído a outras PAs
            atribuicoes_existentes = AtribuicaoFuncionarioPA.objects.filter(
                funcionario=funcionario,
                ativo=True
            ).exclude(posicao_atendimento_id=pa_id)
            
            # Rastrear PAs afetadas e desativar atribuições anteriores
            for atribuicao in atribuicoes_existentes:
                pa_afetada = atribuicao.posicao_atendimento
                pa_info = {
                    'id': pa_afetada.id,
                    'numero': pa_afetada.numero,
                    'sala': pa_afetada.sala.nome if pa_afetada.sala else 'S/Sala',
                    'ilha': pa_afetada.ilha.nome if pa_afetada.ilha else 'S/Ilha',
                    'status': 'livre'
                }
                pas_afetadas.append(pa_info)
                
                # Desativar atribuição
                atribuicao_data = {
                    'ativo': False,
                    'data_fim': timezone.now().date()
                }
                for field, value in atribuicao_data.items():
                    setattr(atribuicao, field, value)
                atribuicao.save()
                
                # Atualizar status da PA afetada
                pa_afetada.status = 'livre'
                pa_afetada.save()
            
            # Buscar e desativar atribuições ativas existentes para esta PA
            atribuicoes_existentes_pa = AtribuicaoFuncionarioPA.objects.filter(
                posicao_atendimento=pa, 
                ativo=True
            )
            
            if atribuicoes_existentes_pa.exists():
                update_data = {
                    'ativo': False,
                    'data_fim': timezone.now().date()
                }
                atribuicoes_existentes_pa.update(**update_data)
            
            # Criar nova atribuição
            atribuicao_data = {
                'posicao_atendimento': pa,
                'funcionario': funcionario,
                'data_inicio': timezone.now().date(),
                'ativo': True
            }
            AtribuicaoFuncionarioPA.objects.create(**atribuicao_data)
            
            # Atualizar status da PA
            pa.status = config['status_pa']
            pa.save()
            
            # Dados do funcionário para resposta
            funcionario_data = {
                'id': funcionario.id,
                'nome_completo': funcionario.nome_completo,
                'ramal': funcionario.ramal_ti.numero if hasattr(funcionario, 'ramal_ti') and funcionario.ramal_ti else '',
                'empresa': funcionario.empresa.nome if funcionario.empresa else '',
                'setor': funcionario.setor.nome if funcionario.setor else ''
            }
            
            # Preparar resposta de sucesso
            response_data = {
                'funcionario': funcionario_data,
                'pa_numero': pa.numero,
                'pas_afetadas': pas_afetadas,
                'novo_status': pa.status,
                'message': config['message_template'].format(
                    funcionario=funcionario.nome_completo,
                    pa=pa.numero
                )
            }
            
            return JsonResponse(build_response_data(True, **response_data))
        else:
            # Operação de remoção
            config = operation_config['remove']
            
            # Desativar atribuições existentes
            update_data = {
                'ativo': False,
                'data_fim': timezone.now().date()
            }
            AtribuicaoFuncionarioPA.objects.filter(
                posicao_atendimento=pa, 
                ativo=True
            ).update(**update_data)
            
            # Atualizar status da PA
            pa.status = config['status_pa']
            pa.save()
            
            # Preparar resposta de remoção
            response_data = {
                'funcionario': None,  # Indica que o funcionário foi removido
                'pa_numero': pa.numero,
                'pas_afetadas': [],  # Nenhuma outra PA afetada neste caso
                'novo_status': pa.status,
                'message': config['message_template'].format(pa=pa.numero)
            }
            
            return JsonResponse(build_response_data(True, **response_data))
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao processar atribuição de funcionário à PA: {str(e)}", exc_info=True)
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

# Views para Computadores
@login_required
def computador_create(request):
    if request.method == 'POST':
        form = ComputadorForm(request.POST)
        if form.is_valid():
            computador = form.save(commit=False)
            status = form.cleaned_data['status']
            
            # Processar campos específicos para cada status
            if status == 'em_uso':
                pa_id = request.POST.get('pa_em_uso')
                if pa_id:
                    # Salvar o computador primeiro
                    computador.save()
                    
                    # Obter a PA selecionada
                    try:
                        pa = PosicaoAtendimento.objects.get(id=pa_id)
                        
                        # Criar uma atribuição de computador à PA
                        AtribuicaoComputadorPA.objects.create(
                            computador=computador,
                            posicao_atendimento=pa,
                            data_atribuicao=timezone.now(),
                            ativo=True
                        )
                        
                        messages.success(request, f'Computador cadastrado e atribuído à PA {pa.numero} com sucesso!')
                    except PosicaoAtendimento.DoesNotExist:
                        messages.error(request, 'Posição de Atendimento não encontrada.')
                        # Ainda salvamos o computador mesmo se a PA não for encontrada
                        computador.save()
                else:
                    # Se nenhuma PA for selecionada, apenas salvar o computador
                    computador.save()
                    messages.success(request, 'Computador cadastrado com sucesso, mas nenhuma PA foi selecionada.')
            
            elif status == 'manutencao':
                # Adicionar observações de manutenção ao computador
                observacoes_manutencao = request.POST.get('observacoes_manutencao')
                if observacoes_manutencao:
                    computador.observacoes = f"MANUTENÇÃO: {observacoes_manutencao}"
                
                computador.save()
                messages.success(request, 'Computador cadastrado e enviado para manutenção com sucesso!')
                
                # Redirecionar para a página de controle de manutenção
                return redirect('ti:controle_manutencao')
            
            else:
                # Para os outros status, apenas salvar o computador
                computador.save()
                messages.success(request, 'Computador cadastrado com sucesso!')
            
            return redirect('ti:admin')
    else:
        form = ComputadorForm()
    
    context = {
        'form': form
    }
    return render(request, 'apps/ti/admin.html', context)

@login_required
def api_post_computador_create(request):
    """
    API POST para cadastrar computador com diferentes status e atribuições.
    
    Args:
        request: HttpRequest com dados do formulário
    
    Returns:
        JsonResponse com resultado da operação
    """
    if request.method != 'POST':
        return JsonResponse(
            build_response_data(False, error='Método não permitido'),
            status=405
        )
    
    try:
        form = ComputadorForm(request.POST)
        if not form.is_valid():
            errors = []
            for field, error_list in form.errors.items():
                for error in error_list:
                    errors.append(f"{field}: {error}")
            return JsonResponse(
                build_response_data(False, error=f'Erro de validação: {"; ".join(errors)}'),
                status=400
            )
        
        computador = form.save(commit=False)
        status = form.cleaned_data['status']
        
        # Configuração de processamento por status
        status_config = {
            'em_uso': {
                'pa_field': 'pa_em_uso',
                'message_with_pa': 'Computador cadastrado e atribuído à PA {pa_numero} com sucesso!',
                'message_no_pa': 'Computador cadastrado com sucesso, mas nenhuma PA foi selecionada.',
                'message_pa_not_found': 'Computador cadastrado com sucesso, mas a PA selecionada não foi encontrada.',
                'requires_pa': True
            },
            'manutencao': {
                'observacoes_field': 'observacoes_manutencao',
                'observacoes_prefix': 'MANUTENÇÃO: ',
                'message': 'Computador cadastrado e enviado para manutenção com sucesso!',
                'requires_pa': False
            },
            'default': {
                'message': 'Computador cadastrado com sucesso!',
                'requires_pa': False
            }
        }
        
        config = status_config.get(status, status_config['default'])
        
        # Processar status específicos
        if status == 'em_uso' and config['requires_pa']:
            pa_id = request.POST.get(config['pa_field'])
            
            if pa_id:
                computador.save()
                
                try:
                    pa = PosicaoAtendimento.objects.get(id=pa_id)
                    
                    # Dados para criar atribuição
                    atribuicao_data = {
                        'computador': computador,
                        'posicao_atendimento': pa,
                        'data_atribuicao': timezone.now(),
                        'ativo': True
                    }
                    AtribuicaoComputadorPA.objects.create(**atribuicao_data)
                    
                    return JsonResponse(
                        build_response_data(
                            True, 
                            message=config['message_with_pa'].format(pa_numero=pa.numero)
                        )
                    )
                    
                except PosicaoAtendimento.DoesNotExist:
                    return JsonResponse(
                        build_response_data(True, message=config['message_pa_not_found'])
                    )
            else:
                computador.save()
                return JsonResponse(
                    build_response_data(True, message=config['message_no_pa'])
                )
        
        elif status == 'manutencao':
            # Processar observações de manutenção
            observacoes_manutencao = request.POST.get(config['observacoes_field'])
            if observacoes_manutencao:
                computador.observacoes = f"{config['observacoes_prefix']}{observacoes_manutencao}"
            
            computador.save()
            return JsonResponse(
                build_response_data(True, message=config['message'])
            )
        
        else:
            # Status padrão
            computador.save()
            return JsonResponse(
                build_response_data(True, message=config['message'])
            )
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao cadastrar computador: {str(e)}", exc_info=True)
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

@login_required
def atribuicao_computador_pa_create(request):
    if request.method == 'POST':
        form = AtribuicaoComputadorPAForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Atribuição de computador realizada com sucesso!')
            return redirect('ti:admin')
    else:
        form = AtribuicaoComputadorPAForm()
    
    context = {
        'form': form
    }
    return render(request, 'apps/ti/admin.html', context)

# Views para Monitores
@login_required
def monitor_list(request):
    monitores = Monitor.objects.all().select_related('loja')
    context = {
        'monitores': monitores
    }
    return render(request, 'ti/monitor_list.html', context)

@login_required
def monitor_create(request):
    if request.method == 'POST':
        form = MonitorForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Monitor cadastrado com sucesso!')
            return redirect('ti:admin')
    else:
        form = MonitorForm()
    
    context = {
        'form': form,
        'title': 'Cadastrar Novo Monitor'
    }
    return render(request, 'apps/ti/admin.html', context)

@login_required
def monitor_update(request, pk):
    monitor = get_object_or_404(Monitor, pk=pk)
    if request.method == 'POST':
        form = MonitorForm(request.POST, instance=monitor)
        if form.is_valid():
            form.save()
            messages.success(request, 'Monitor atualizado com sucesso!')
            return redirect('ti:monitor_list')
    else:
        form = MonitorForm(instance=monitor)
    
    context = {
        'form': form,
        'monitor': monitor
    }
    return render(request, 'ti/monitor_form.html', context)

@login_required
def monitor_delete(request, pk):
    monitor = get_object_or_404(Monitor, pk=pk)
    if request.method == 'POST':
        monitor.delete()
        messages.success(request, 'Monitor excluído com sucesso!')
        return redirect('ti:monitor_list')
    
    context = {
        'title': 'Excluir Monitor',
        'objeto': monitor
    }
    return render(request, 'apps/ti/confirm_delete.html', context)

# Views para Atribuição de Monitores a PAs
@login_required
def atribuicao_monitor_pa_create(request):
    if request.method == 'POST':
        form = AtribuicaoMonitorPAForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Atribuição de monitor realizada com sucesso!')
            return redirect('ti:admin')
    else:
        form = AtribuicaoMonitorPAForm()
    
    context = {
        'form': form
    }
    return render(request, 'apps/ti/admin.html', context)

@require_GET
@login_required
def api_get_monitores_disponiveis(request):
    """
    API para retornar monitores disponíveis para atribuição
    Retorna uma lista de monitores com status 'disponivel'
    Considera filtro por loja se especificado
    """
    try:
        # Obter a loja selecionada, se houver
        loja_id = request.GET.get('loja')
        filtro_loja = {}
        
        if loja_id:
            try:
                loja_selecionada = int(loja_id)
                filtro_loja = {'loja_id': loja_selecionada}
            except (ValueError, TypeError):
                pass
        
        # Buscar monitores com status 'disponivel' ou 'manutencao'
        monitores_disponiveis = Monitor.objects.filter(
            status__in=['disponivel', 'manutencao'],
            **filtro_loja
        ).values('id', 'marca', 'modelo', 'tamanho', 'resolucao')
        
        # Converter para lista para serialização JSON
        monitores_lista = list(monitores_disponiveis)
        
        return JsonResponse({
            'success': True,
            'monitores': monitores_lista
        })
    except Exception as e:
        import traceback
        print(f"Erro ao buscar monitores disponíveis: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# APIs para Monitores
@require_POST
@login_required
def api_post_adicionar_monitor_pa(request, pa_id):
    try:
        data = json.loads(request.body)
        monitor_id = data.get('monitor_id')

        if not monitor_id:
            return gerar_resposta_api(False, error='ID do Monitor não fornecido.', status=400)

        pa_alvo = get_object_or_404(PosicaoAtendimento, pk=pa_id)
        monitor = get_object_or_404(Monitor, pk=monitor_id)

        # Verificar se o monitor já está atribuído a outra PA
        atribuicao_existente = AtribuicaoMonitorPA.objects.filter(
            monitor=monitor,
            ativo=True
        ).exclude(posicao_atendimento=pa_alvo).first()
        
        if atribuicao_existente:
            return gerar_resposta_api(
                False, 
                error=f'Monitor já está atribuído à PA {atribuicao_existente.posicao_atendimento.numero}',
                status=400
            )
        
        # Verificar se já existe atribuição ativa para esta PA e monitor
        atribuicao_ativa = AtribuicaoMonitorPA.objects.filter(
            monitor=monitor,
            posicao_atendimento=pa_alvo,
            ativo=True
        ).first()
        
        if atribuicao_ativa:
            return gerar_resposta_api(
                False,
                error='Monitor já está atribuído a esta PA',
                status=400
            )
        
        # Criar nova atribuição
        AtribuicaoMonitorPA.objects.create(
            monitor=monitor,
            posicao_atendimento=pa_alvo,
            ativo=True
        )
        
        # Atualizar status do monitor
        monitor.status = 'em_uso'
        monitor.save()
        
        # Listar monitores atribuídos à PA para a resposta
        lista_monitores_pa = []
        atribuicoes_pa = AtribuicaoMonitorPA.objects.filter(
            posicao_atendimento=pa_alvo,
            ativo=True
        ).select_related('monitor')
        
        for atr in atribuicoes_pa:
            lista_monitores_pa.append({
                'id': atr.monitor.id,
                'marca': atr.monitor.marca,
                'tamanho': atr.monitor.tamanho
            })

        return gerar_resposta_api(
            True, 
            message='Monitor adicionado à PA com sucesso!',
            data={'lista_monitores_pa': lista_monitores_pa}
        )

    except PosicaoAtendimento.DoesNotExist:
        return gerar_resposta_api(False, error='PA não encontrada.', status=404)
    except Monitor.DoesNotExist:
        return gerar_resposta_api(False, error='Monitor não encontrado.', status=404)
    except json.JSONDecodeError:
        return gerar_resposta_api(False, error='Dados JSON inválidos.', status=400)
    except Exception as e:
        return gerar_resposta_api(False, error=str(e), status=500)

@require_POST
@login_required
def api_post_remover_monitor_pa(request, pa_id):
    try:
        data = json.loads(request.body)
        monitor_id = data.get('monitor_id')

        if not monitor_id:
            return gerar_resposta_api(False, error='ID do Monitor não fornecido.', status=400)

        pa_alvo = get_object_or_404(PosicaoAtendimento, pk=pa_id)
        monitor = get_object_or_404(Monitor, pk=monitor_id)

        atribuicao_ativa = AtribuicaoMonitorPA.objects.filter(
            posicao_atendimento=pa_alvo, 
            monitor=monitor, 
            ativo=True
        ).first()

        if not atribuicao_ativa:
            return gerar_resposta_api(False, error='Monitor não está ativamente atribuído a esta PA.', status=400)

        # Desativar a atribuição
        atribuicao_ativa.ativo = False
        atribuicao_ativa.data_remocao = timezone.now()
        atribuicao_ativa.save()
        
        # Atualizar status do monitor
        monitor.status = 'disponivel'
        monitor.save()
        
        # Listar monitores atribuídos à PA para a resposta
        lista_monitores_pa = []
        atribuicoes_pa = AtribuicaoMonitorPA.objects.filter(
            posicao_atendimento=pa_alvo,
            ativo=True
        ).select_related('monitor')
        
        for atr in atribuicoes_pa:
            lista_monitores_pa.append({
                'id': atr.monitor.id,
                'marca': atr.monitor.marca,
                'tamanho': atr.monitor.tamanho
            })

        return gerar_resposta_api(
            True,
            message='Monitor removido da PA com sucesso!',
            data={'lista_monitores_pa': lista_monitores_pa}
        )

    except PosicaoAtendimento.DoesNotExist:
        return gerar_resposta_api(False, error='PA não encontrada.', status=404)
    except Monitor.DoesNotExist:
        return gerar_resposta_api(False, error='Monitor não encontrado.', status=404)
    except json.JSONDecodeError:
        return gerar_resposta_api(False, error='Dados JSON inválidos.', status=400)
    except Exception as e:
        return gerar_resposta_api(False, error=str(e), status=500)

@require_POST
@login_required
def api_post_atualizar_status_monitor(request, monitor_id):
    try:
        data = json.loads(request.body)
        novo_status = data.get('status')
        pa_id = data.get('pa_id')  # PA da qual o monitor está sendo gerenciado no frontend
        observacoes = data.get('observacoes')

        if not novo_status or novo_status not in [s[0] for s in Monitor.status_choices]:
            return JsonResponse({'success': False, 'error': 'Status inválido fornecido.'}, status=400)

        monitor = get_object_or_404(Monitor, pk=monitor_id)

        monitor.status = novo_status
        if novo_status == 'manutencao':
            if observacoes:
                monitor.observacoes = observacoes
            else:
                monitor.observacoes = None
        elif novo_status == 'disponivel':
            if monitor.observacoes and monitor.observacoes.startswith("MANUTENÇÃO:"):
                monitor.observacoes = None
            elif not monitor.observacoes:
                pass

        monitor.save()
        
        partes_mensagem = [
            f'Status do monitor {monitor.marca} atualizado para {monitor.get_status_display()}.'
        ]
        monitor_removido_da_pa_especifica = False
        lista_monitores_pa_atualizada = []

        if (novo_status == 'disponivel' or novo_status == 'manutencao') and pa_id:
            atribuicao_especifica = AtribuicaoMonitorPA.objects.filter(
                monitor=monitor,
                posicao_atendimento_id=pa_id,
                ativo=True
            ).first()
            
            if atribuicao_especifica:
                atribuicao_especifica.ativo = False
                atribuicao_especifica.data_remocao = timezone.now()
                atribuicao_especifica.save()
                monitor_removido_da_pa_especifica = True
                acao = "para manutenção" if novo_status == 'manutencao' else "pois está livre"
                partes_mensagem.append(f'Ele foi desatribuído da PA {atribuicao_especifica.posicao_atendimento.numero} {acao}.')
                
                pa_alvo = get_object_or_404(PosicaoAtendimento, pk=pa_id)
                atribuicoes_pa_atual = AtribuicaoMonitorPA.objects.filter(
                    posicao_atendimento=pa_alvo, 
                    ativo=True
                ).select_related('monitor')
                for atr in atribuicoes_pa_atual:
                    lista_monitores_pa_atualizada.append({
                        'id': atr.monitor.id,
                        'marca': atr.monitor.marca,
                        'tamanho': atr.monitor.tamanho
                    })
        
        mensagem_final = " ".join(partes_mensagem)

        return JsonResponse({
            'success': True, 
            'message': mensagem_final,
            'novo_status_display': monitor.get_status_display(),
            'monitor_removido_da_pa': monitor_removido_da_pa_especifica,
            'lista_monitores_pa': lista_monitores_pa_atualizada
        })

    except Monitor.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Monitor não encontrado.'}, status=404)
    except PosicaoAtendimento.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'PA não encontrada ao tentar atualizar lista de monitores.'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Dados JSON inválidos.'}, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@require_POST
@login_required
def api_post_cadastrar_atribuicoes_perifericos_lote(request):
    """
    API POST para cadastrar várias atribuições de periféricos de uma só vez.
    Recebe um JSON com um array de atribuições.
    """
    # Extrair dados JSON
    json_result = extract_json_data(request)
    if not json_result['success']:
        response_data = build_response_data(
            success=False,
            error=json_result['error']
        )
        return JsonResponse(response_data, status=400)
    
    data = json_result['data']
    atribuicoes = data.get('atribuicoes', [])
    
    if not atribuicoes:
        response_data = build_response_data(
            success=False,
            error='Nenhuma atribuição fornecida'
        )
        return JsonResponse(response_data, status=400)
    
    try:
        resultados = []
        
        # Processar cada atribuição
        for item in atribuicoes:
            resultado = _processar_atribuicao_periferico(item)
            resultados.append(resultado)
        
        # Verificar se todas as atribuições foram bem-sucedidas
        falhas = [r for r in resultados if not r['success']]
        sucessos = len(resultados) - len(falhas)
        
        response_data = build_response_data(
            success=len(falhas) == 0,
            message=f'{sucessos} atribuições realizadas com sucesso, {len(falhas)} falhas',
            data={
                'total_processadas': len(resultados),
                'sucessos': sucessos,
                'falhas': len(falhas),
                'resultados': resultados
            }
        )
        
        return JsonResponse(response_data)
        
    except Exception as e:
        response_data = build_response_data(
            success=False,
            error=f'Erro interno: {str(e)}'
        )
        return JsonResponse(response_data, status=500)


def _processar_atribuicao_periferico(item):
    """
    Processa uma única atribuição de periférico.
    
    Args:
        item: dict com dados da atribuição
    
    Returns:
        dict: resultado do processamento
    """
    try:
        periferico_id = item.get('periferico')
        pa_id = item.get('posicao_atendimento')
        data_str = item.get('data_atribuicao')
        
        # Validar dados básicos
        if not all([periferico_id, pa_id]):
            return {
                'success': False,
                'error': 'Dados incompletos',
                'periferico_id': periferico_id,
                'pa_id': pa_id
            }
        
        # Verificar se o periférico existe
        try:
            periferico = Periferico.objects.get(id=periferico_id)
        except Periferico.DoesNotExist:
            return {
                'success': False,
                'error': 'Periférico não encontrado',
                'periferico_id': periferico_id,
                'pa_id': pa_id
            }
        
        # Verificar se a PA existe
        try:
            pa = PosicaoAtendimento.objects.get(id=pa_id)
        except PosicaoAtendimento.DoesNotExist:
            return {
                'success': False,
                'error': 'PA não encontrada',
                'periferico_id': periferico_id,
                'pa_id': pa_id
            }
        
        # Processar data de atribuição
        data_atribuicao = timezone.now()
        if data_str:
            try:
                data_atribuicao = timezone.datetime.fromisoformat(data_str)
            except (ValueError, TypeError):
                # Se a data for inválida, usa a hora atual
                pass
        
        # Verificar se já existe uma atribuição ativa deste periférico
        atribuicao_existente = AtribuicaoPerifericoPA.objects.filter(
            periferico=periferico,
            ativo=True
        ).first()
        
        if atribuicao_existente:
            # Desativar atribuição existente
            atribuicao_existente.ativo = False
            atribuicao_existente.data_remocao = timezone.now()
            atribuicao_existente.save()
        
        # Criar nova atribuição
        nova_atribuicao = AtribuicaoPerifericoPA.objects.create(
            periferico=periferico,
            posicao_atendimento=pa,
            data_atribuicao=data_atribuicao,
            ativo=True
        )
        
        # Atualizar status do periférico
        periferico.status = 'em_uso'
        periferico.save()
        
        return {
            'success': True,
            'periferico_id': periferico_id,
            'pa_id': pa_id,
            'atribuicao_id': nova_atribuicao.id,
            'data_atribuicao': data_atribuicao.isoformat()
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'periferico_id': item.get('periferico'),
            'pa_id': item.get('posicao_atendimento')
        }

@require_GET
@login_required
def api_get_computadores_disponiveis(request):
    """
    API para retornar computadores disponíveis para atribuição
    Retorna uma lista de computadores com status 'disponivel'
    Considera filtro por loja se especificado
    """
    try:
        from .models import Computador  # Importar aqui para evitar importação circular
        
        # Obter a loja selecionada, se houver
        loja_id = request.GET.get('loja')
        filtro_loja = {}
        
        if loja_id:
            try:
                loja_selecionada = int(loja_id)
                filtro_loja = {'loja_id': loja_selecionada}
            except (ValueError, TypeError):
                pass
        
        # Buscar computadores com status 'disponivel' ou 'manutencao'
        computadores_disponiveis = Computador.objects.filter(
            status__in=['disponivel', 'manutencao'],
            **filtro_loja
        ).values('id', 'marca')
        
        # Converter para lista para serialização JSON
        computadores_lista = list(computadores_disponiveis)
        
        # Adicionar o campo 'condicao' para compatibilidade com o JavaScript
        for computador in computadores_lista:
            # Buscar o valor real da condição do computador
            comp_obj = Computador.objects.get(id=computador['id'])
            computador['condicao'] = comp_obj.condicao
        
        return JsonResponse({
            'success': True,
            'computadores': computadores_lista
        })
    except Exception as e:
        import traceback
        print(f"Erro ao buscar computadores disponíveis: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# Views para Tipos de Periféricos
@login_required
def tipo_periferico_list(request):
    tipos = TipoPeriferico.objects.all().order_by('nome')
    context = {
        'tipos': tipos
    }
    return render(request, 'apps/ti/admin.html', context)

@login_required
def tipo_periferico_create(request):
    if request.method == 'POST':
        form = TipoPerifericoForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Tipo de periférico cadastrado com sucesso!')
            return redirect('ti:admin')
    else:
        form = TipoPerifericoForm()
    
    context = {
        'form': form
    }
    return render(request, 'apps/ti/admin.html', context)

@login_required
def tipo_periferico_update(request, pk):
    tipo = get_object_or_404(TipoPeriferico, pk=pk)
    if request.method == 'POST':
        form = TipoPerifericoForm(request.POST, instance=tipo)
        if form.is_valid():
            form.save()
            messages.success(request, 'Tipo de periférico atualizado com sucesso!')
            return redirect('ti:tipo_periferico_list')
    else:
        form = TipoPerifericoForm(instance=tipo)
    
    context = {
        'form': form,
        'tipo': tipo
    }
    return render(request, 'apps/ti/admin.html', context)

@login_required
def tipo_periferico_delete(request, pk):
    tipo = get_object_or_404(TipoPeriferico, pk=pk)
    if request.method == 'POST':
        tipo.delete()
        messages.success(request, 'Tipo de periférico excluído com sucesso!')
        return redirect('ti:tipo_periferico_list')
    
    context = {
        'title': 'Excluir Tipo de Periférico',
        'objeto': tipo
    }
    return render(request, 'apps/ti/confirm_delete.html', context)

# APIs para carregamento rápido
@login_required
@require_GET
def api_get_admin_dashboard_data(request):
    """
    API para carregamento rápido dos dados do dashboard administrativo de TI
    Considera filtro por loja se especificado
    """
    try:
        # Obter a loja selecionada, se houver
        loja_id = request.GET.get('loja')
        loja_selecionada = None
        
        # Aplicar filtro de loja se necessário
        if loja_id:
            try:
                loja_selecionada = int(loja_id)
            except (ValueError, TypeError):
                loja_selecionada = None
        
        filtro_loja = {'loja_id': loja_selecionada} if loja_selecionada else {}
        
        data = {
            'counts': {
                'tipos_perifericos': TipoPeriferico.objects.all().count(),
                'perifericos': Periferico.objects.filter(**filtro_loja).count(),
                'monitores': Monitor.objects.filter(**filtro_loja).count(),
                'salas': Sala.objects.filter(**filtro_loja).count(),
                'ilhas': Ilha.objects.filter(sala__in=Sala.objects.filter(**filtro_loja)).count(),
                'posicoes_atendimento': PosicaoAtendimento.objects.filter(sala__in=Sala.objects.filter(**filtro_loja)).count(),
                'atribuicoes_funcionarios': AtribuicaoFuncionarioPA.objects.filter(
                    ativo=True,
                    posicao_atendimento__sala__in=Sala.objects.filter(**filtro_loja)
                ).count(),
                'atribuicoes_perifericos': AtribuicaoPerifericoPA.objects.filter(
                    ativo=True,
                    periferico__in=Periferico.objects.filter(**filtro_loja)
                ).count(),
                'atribuicoes_monitores': AtribuicaoMonitorPA.objects.filter(
                    ativo=True,
                    monitor__in=Monitor.objects.filter(**filtro_loja)
                ).count(),
            },
            'listas': {
                'tipos_perifericos': list(TipoPeriferico.objects.all().values('id', 'nome')),
                'salas': list(Sala.objects.filter(**filtro_loja).values('id', 'nome')),
                'perifericos_disponiveis': list(Periferico.objects.filter(status__in=['disponivel', 'manutencao'], **filtro_loja).values('id', 'marca', 'modelo', 'tipo__nome')),
                'computadores_disponiveis': list(Computador.objects.filter(status__in=['disponivel', 'manutencao'], **filtro_loja).values('id', 'marca')),
                'monitores_disponiveis': list(Monitor.objects.filter(status__in=['disponivel', 'manutencao'], **filtro_loja).values('id', 'marca', 'tamanho')),
                'funcionarios': list(Funcionario.objects.filter(
                    Q(empresa__lojas__id=loja_selecionada) if loja_selecionada else Q(),
                    status=True
                ).values('id', 'nome_completo', 'ramal').order_by('nome_completo')),
                'posicoes_atendimento': list(PosicaoAtendimento.objects.filter(
                    sala__in=Sala.objects.filter(**filtro_loja)
                ).values('id', 'numero', 'sala__nome', 'ilha__nome')),
                'lojas': list(Loja.objects.filter(status=True).values('id', 'nome').order_by('nome')),
                'ilhas': list(Ilha.objects.filter(sala__in=Sala.objects.filter(**filtro_loja)).values('id', 'nome')),
            },
            'loja_selecionada': loja_selecionada
        }
        return JsonResponse({'success': True, 'data': data})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@require_GET
def api_get_controle_salas_data(request):
    """
    API para carregamento rápido dos dados da página de controle de salas
    """
    try:
        # Obter parâmetros de filtro da URL
        sala_id = request.GET.get('sala_id')
        ilha_id = request.GET.get('ilha_id')
        loja_id = request.GET.get('loja_id')
        
        # Aplicar filtro de loja se especificado
        filtro_loja = {'loja_id': loja_id} if loja_id else {}
        
        # Carregar salas com suas ilhas (aplicando filtros se necessário)
        if sala_id:
            salas = Sala.objects.filter(id=sala_id, **filtro_loja)
        else:
            salas = Sala.objects.filter(**filtro_loja)
            
        salas_data = []
        
        # Obter tipos de periféricos comuns (aqueles esperados em cada PA)
        tipos_perifericos_comuns = list(TipoPeriferico.objects.filter(
            nome__in=['Mouse', 'Teclado', 'Monitor', 'Fone', 'Mousepad']
        ).values('id', 'nome'))
        
        # Criar um mapa de IDs e nomes para facilitar a busca
        tipos_comuns_map = {tipo['id']: tipo['nome'] for tipo in tipos_perifericos_comuns}
        
        # Carregar todas as atribuições de periféricos ativas
        atribuicoes_perifericos = AtribuicaoPerifericoPA.objects.filter(
            ativo=True
        ).select_related(
            'periferico', 'periferico__tipo', 'posicao_atendimento'
        )
        
        # Mapear periféricos por PA
        perifericos_por_pa = {}
        # Mapear tipos de periféricos já atribuídos por PA
        tipos_atribuidos_por_pa = {}
        
        for atr in atribuicoes_perifericos:
            pa_id = atr.posicao_atendimento_id
            
            # Inicializar listas se necessário
            if pa_id not in perifericos_por_pa:
                perifericos_por_pa[pa_id] = []
            if pa_id not in tipos_atribuidos_por_pa:
                tipos_atribuidos_por_pa[pa_id] = set()
            
            # Adicionar periférico à lista
            perifericos_por_pa[pa_id].append({
                'id': atr.periferico.id,
                'tipo': atr.periferico.tipo.nome,
                'marca': atr.periferico.marca,
                'modelo': atr.periferico.modelo
            })
            
            # Registrar que este tipo já está atribuído a esta PA
            tipos_atribuidos_por_pa[pa_id].add(atr.periferico.tipo_id)
        
        # Carregar atribuições de computadores ativas
        atribuicoes_computadores = AtribuicaoComputadorPA.objects.filter(
            ativo=True
        ).select_related(
            'computador', 'posicao_atendimento'
        )
        
        # Mapear computadores por PA
        computadores_por_pa = {}
        
        for atr in atribuicoes_computadores:
            pa_id = atr.posicao_atendimento_id
            
            # Inicializar lista se necessário
            if pa_id not in computadores_por_pa:
                computadores_por_pa[pa_id] = []
            
            # Adicionar computador à lista
            computadores_por_pa[pa_id].append({
                'id': atr.computador.id,
                'marca': atr.computador.marca
            })
        
        for sala in salas:
            sala_dict = {
                'id': sala.id,
                'nome': sala.nome,
                'ilhas': []
            }
            
            # Aplicar filtro de ilha, se especificado
            ilhas_queryset = sala.ilhas.all()
            if ilha_id:
                ilhas_queryset = ilhas_queryset.filter(id=ilha_id)
                
            for ilha in ilhas_queryset:
                ilha_dict = {
                    'id': ilha.id,
                    'nome': ilha.nome,
                    'quantidade_pas': ilha.quantidade_pas,
                    'posicoes': []
                }
                
                # Carregar PAs para esta ilha
                pas = PosicaoAtendimento.objects.filter(ilha=ilha)
                
                # Carregar funcionários atribuídos às PAs desta ilha
                funcionarios_por_pa_ilha = {}
                atribuicoes_funcionarios_ilha = AtribuicaoFuncionarioPA.objects.filter(
                    ativo=True,
                    posicao_atendimento__ilha=ilha
                ).select_related('funcionario', 'posicao_atendimento')
                
                for atr_func in atribuicoes_funcionarios_ilha:
                    funcionarios_por_pa_ilha[atr_func.posicao_atendimento_id] = atr_func.funcionario
                
                for pa in pas:
                    # Determinar quais tipos de periféricos estão faltando
                    tipos_faltantes = []
                    for tipo_id, tipo_nome in tipos_comuns_map.items():
                        if pa.id not in tipos_atribuidos_por_pa or tipo_id not in tipos_atribuidos_por_pa[pa.id]:
                            tipos_faltantes.append(tipo_nome)
                    
                    # Obter funcionário atribuído a esta PA
                    funcionario_pa = funcionarios_por_pa_ilha.get(pa.id)
                    
                    pa_dict = {
                        'id': pa.id,
                        'numero': pa.numero,
                        'status': pa.status,
                        'status_display': pa.get_status_display(),
                        'funcionario': funcionario_pa.nome_completo if funcionario_pa else None,
                        'perifericos': perifericos_por_pa.get(pa.id, []),
                        'faltando': tipos_faltantes,
                        'computadores': computadores_por_pa.get(pa.id, [])
                    }
                    ilha_dict['posicoes'].append(pa_dict)
                
                sala_dict['ilhas'].append(ilha_dict)
            
            salas_data.append(sala_dict)
        
        # Dados de periféricos e computadores disponíveis
        perifericos_disponiveis = list(Periferico.objects.filter(
            status='disponivel'
        ).values('id', 'marca', 'modelo', 'tipo__id', 'tipo__nome'))
        
        computadores_disponiveis = list(Computador.objects.filter(
            status='disponivel'
        ).values('id', 'marca'))
        
        return JsonResponse({
            'success': True,
            'data': {
                'salas': salas_data,
                'tipos_perifericos_comuns': tipos_perifericos_comuns,
                'perifericos_disponiveis': perifericos_disponiveis,
                'computadores_disponiveis': computadores_disponiveis
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@require_GET
def api_get_controle_estoque_data(request):
    """
    API para carregamento rápido dos dados da página de controle de estoque
    """
    try:
        # Obter a loja selecionada, se houver
        loja_id = request.GET.get('loja')
        loja_selecionada = None
        
        # Aplicar filtro de loja se necessário
        filtro_loja = {'loja_id': loja_id} if loja_id else {}
        
        # Obter salas com suas ilhas
        salas = Sala.objects.all().prefetch_related('ilhas')
        
        # Obter tipos de periféricos
        tipos_perifericos = list(TipoPeriferico.objects.all().order_by('nome').values('id', 'nome'))
        
        # Calcular o total de periféricos por tipo
        perifericos_totais_por_tipo = {}
        for tipo in tipos_perifericos:
            total_tipo = Periferico.objects.filter(
                tipo_id=tipo['id'], 
                status='disponivel',
                **filtro_loja
            ).exclude(
                id__in=AtribuicaoPerifericoPA.objects.filter(ativo=True).values_list('periferico_id', flat=True)
            ).count()
            
            perifericos_totais_por_tipo[tipo['id']] = total_tipo
        
        # Obter todas as marcas de computadores
        todas_as_marcas = list(Computador.objects.values_list('marca', flat=True).distinct())
        
        # Computadores disponíveis por marca
        computadores_disponiveis = []
        for marca in todas_as_marcas:
            query = Computador.objects.filter(marca=marca, status='disponivel', **filtro_loja)
            quantidade = query.count()
            computadores_disponiveis.append({
                'marca': marca,
                'quantidade_disponivel': quantidade
            })
        
        # Estatísticas gerais
        estatisticas = {
            'computadores': {
                'total': Computador.objects.filter(**filtro_loja).count(),
                'disponiveis': Computador.objects.filter(status='disponivel', **filtro_loja).count(),
                'em_uso': Computador.objects.filter(status='em_uso', **filtro_loja).count(),
                'manutencao': Computador.objects.filter(status='manutencao', **filtro_loja).count()
            },
            'perifericos': {
                'total': Periferico.objects.filter(**filtro_loja).count(),
                'disponiveis': Periferico.objects.filter(status='disponivel', **filtro_loja).count(),
                'em_uso': Periferico.objects.filter(status='em_uso', **filtro_loja).count(),
                'manutencao': Periferico.objects.filter(status='manutencao', **filtro_loja).count()
            }
        }
        
        # Histórico recente (limitado a 20 registros)
        historico = []
        perifericos_historico = AtribuicaoPerifericoPA.objects.select_related(
            'periferico', 'periferico__tipo', 'posicao_atendimento'
        ).order_by('-data_atribuicao')[:10]
        
        for atribuicao in perifericos_historico:
            if atribuicao.data_atribuicao:
                historico.append({
                    'data': atribuicao.data_atribuicao.isoformat(),
                    'tipo': 'periferico',
                    'acao': 'atribuicao',
                    'item': f"{atribuicao.periferico.tipo.nome} {atribuicao.periferico.marca}",
                    'pa': f"PA {atribuicao.posicao_atendimento.numero}"
                })
        
        # Lista de lojas para o seletor
        lojas = list(Loja.objects.filter(status=True).values('id', 'nome').order_by('nome'))
        
        return JsonResponse({
            'success': True,
            'data': {
                'salas': list(salas.values('id', 'nome')),
                'ilhas': list(Ilha.objects.values('id', 'nome', 'sala_id')),
                'tipos_perifericos': tipos_perifericos,
                'perifericos_totais_por_tipo': perifericos_totais_por_tipo,
                'computadores_disponiveis_por_marca': computadores_disponiveis,
                'estatisticas': estatisticas,
                'historico': historico,
                'lojas': lojas,
                'loja_selecionada': loja_id
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@require_GET
def api_get_controle_manutencao_data(request):
    """
    API para carregamento rápido dos dados da página de controle de manutenção
    """
    try:
        # Obter periféricos em manutenção
        perifericos_em_manutencao = Periferico.objects.filter(status='manutencao')
        perifericos_data = []
        
        for periferico in perifericos_em_manutencao:
            # Buscar a última PA onde este periférico estava
            ultima_atribuicao = AtribuicaoPerifericoPA.objects.filter(
                periferico=periferico
            ).order_by('-data_atribuicao').first()
            
            perifericos_data.append({
                'id': periferico.id,
                'tipo': periferico.tipo.nome,
                'marca': periferico.marca,
                'modelo': periferico.modelo,
                'observacoes': periferico.observacoes,
                'ultima_pa': {
                    'id': ultima_atribuicao.posicao_atendimento.id,
                    'numero': ultima_atribuicao.posicao_atendimento.numero
                } if ultima_atribuicao else None
            })
        
        # Obter computadores em manutenção
        computadores_em_manutencao = Computador.objects.filter(status='manutencao')
        computadores_data = []
        
        for computador in computadores_em_manutencao:
            # Buscar a última PA onde este computador estava
            ultima_atribuicao = AtribuicaoComputadorPA.objects.filter(
                computador=computador
            ).order_by('-data_atribuicao').first()
            
            computadores_data.append({
                'id': computador.id,
                'marca': computador.marca,
                'observacoes': computador.observacoes,
                'ultima_pa': {
                    'id': ultima_atribuicao.posicao_atendimento.id,
                    'numero': ultima_atribuicao.posicao_atendimento.numero
                } if ultima_atribuicao else None
            })
            
        # Contagem por tipo de equipamento em manutenção
        contagem = {
            'Mouse': perifericos_em_manutencao.filter(tipo__nome='Mouse').count(),
            'Teclado': perifericos_em_manutencao.filter(tipo__nome='Teclado').count(),
            'Monitor': perifericos_em_manutencao.filter(tipo__nome='Monitor').count(),
            'Fone': perifericos_em_manutencao.filter(tipo__nome='Fone').count(),
            'Mousepad': perifericos_em_manutencao.filter(tipo__nome='Mousepad').count(),
            'Computador': computadores_em_manutencao.count(),
            'Outros': perifericos_em_manutencao.exclude(
                tipo__nome__in=['Mouse', 'Teclado', 'Monitor', 'Fone', 'Mousepad']
            ).count()
        }
        
        return JsonResponse({
            'success': True,
            'data': {
                'perifericos': perifericos_data,
                'computadores': computadores_data,
                'contagem': contagem,
                'total': sum(contagem.values())
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@require_GET
def api_get_listar_perifericos(request):
    """
    API para listar todos os periféricos com filtros
    """
    try:
        # Parâmetros de filtro
        tipo_id = request.GET.get('tipo')
        status = request.GET.get('status')
        loja_id = request.GET.get('loja')
        
        # Query base
        query = Periferico.objects.all().select_related('tipo', 'loja')
        
        # Aplicar filtros
        if tipo_id:
            query = query.filter(tipo_id=tipo_id)
        if status:
            # Suportar múltiplos status separados por vírgula
            if ',' in status:
                status_list = [s.strip() for s in status.split(',')]
                query = query.filter(status__in=status_list)
            else:
                query = query.filter(status=status)
        if loja_id:
            try:
                loja_selecionada = int(loja_id)
                query = query.filter(loja_id=loja_selecionada)
            except (ValueError, TypeError):
                pass
        
        # Paginação
        page = int(request.GET.get('page', 1))
        itens_por_pagina = int(request.GET.get('per_page', 20))
        
        # Ordenação
        order_by = request.GET.get('order_by', 'id')
        if order_by.startswith('-'):
            order_by = order_by[1:]
            order_direction = '-'
        else:
            order_direction = ''
            
        # Verificar se o campo de ordenação é válido
        campos_validos = ['id', 'tipo__nome', 'marca', 'modelo', 'status', 'data_aquisicao']
        if order_by not in campos_validos:
            order_by = 'id'
            
        query = query.order_by(f'{order_direction}{order_by}')
        
        # Executar paginação
        paginator = Paginator(query, itens_por_pagina)
        page_obj = paginator.get_page(page)
        
        # Formatar resposta
        perifericos_data = []
        for periferico in page_obj:
            perifericos_data.append({
                'id': periferico.id,
                'tipo': {
                    'id': periferico.tipo.id,
                    'nome': periferico.tipo.nome
                },
                'marca': periferico.marca,
                'modelo': periferico.modelo,
                'data_aquisicao': periferico.data_aquisicao.isoformat() if periferico.data_aquisicao else None,
                'status': periferico.status,
                'status_display': periferico.get_status_display(),
                'loja': {
                    'id': periferico.loja.id,
                    'nome': periferico.loja.nome
                } if periferico.loja else None,
                'observacoes': periferico.observacoes
            })
        
        # Metadados de paginação
        pagination = {
            'page': page,
            'per_page': itens_por_pagina,
            'total_items': paginator.count,
            'total_pages': paginator.num_pages,
            'has_previous': page_obj.has_previous(),
            'has_next': page_obj.has_next(),
            'previous_page': page_obj.previous_page_number() if page_obj.has_previous() else None,
            'next_page': page_obj.next_page_number() if page_obj.has_next() else None,
        }
        
        return JsonResponse({
            'success': True,
            'data': perifericos_data,
            'pagination': pagination
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@require_GET
def api_get_listar_computadores(request):
    """
    API para listar todos os computadores com filtros
    """
    try:
        # Parâmetros de filtro
        status = request.GET.get('status')
        loja_id = request.GET.get('loja')
        
        # Query base
        query = Computador.objects.all().select_related('loja')
        
        # Aplicar filtros
        if status:
            # Suportar múltiplos status separados por vírgula
            if ',' in status:
                status_list = [s.strip() for s in status.split(',')]
                query = query.filter(status__in=status_list)
            else:
                query = query.filter(status=status)
        if loja_id:
            try:
                loja_selecionada = int(loja_id)
                query = query.filter(loja_id=loja_selecionada)
            except (ValueError, TypeError):
                pass
        
        # Paginação
        page = int(request.GET.get('page', 1))
        itens_por_pagina = int(request.GET.get('per_page', 20))
        
        # Ordenação
        order_by = request.GET.get('order_by', 'id')
        if order_by.startswith('-'):
            order_by = order_by[1:]
            order_direction = '-'
        else:
            order_direction = ''
            
        # Verificar se o campo de ordenação é válido
        campos_validos = ['id', 'marca', 'status', 'data_aquisicao']
        if order_by not in campos_validos:
            order_by = 'id'
            
        query = query.order_by(f'{order_direction}{order_by}')
        
        # Executar paginação
        paginator = Paginator(query, itens_por_pagina)
        page_obj = paginator.get_page(page)
        
        # Formatar resposta
        computadores_data = []
        for computador in page_obj:
            computadores_data.append({
                'id': computador.id,
                'marca': computador.marca,
                'data_aquisicao': computador.data_aquisicao.isoformat() if computador.data_aquisicao else None,
                'status': computador.status,
                'status_display': computador.get_status_display(),
                'loja': {
                    'id': computador.loja.id,
                    'nome': computador.loja.nome
                } if computador.loja else None,
                'observacoes': computador.observacoes
            })
        
        # Metadados de paginação
        pagination = {
            'page': page,
            'per_page': itens_por_pagina,
            'total_items': paginator.count,
            'total_pages': paginator.num_pages,
            'has_previous': page_obj.has_previous(),
            'has_next': page_obj.has_next(),
            'previous_page': page_obj.previous_page_number() if page_obj.has_previous() else None,
            'next_page': page_obj.next_page_number() if page_obj.has_next() else None,
        }
        
        return JsonResponse({
            'success': True,
            'data': computadores_data,
            'pagination': pagination
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@require_GET
def api_get_listar_posicoes_atendimento(request):
    """
    API para listar todas as posições de atendimento com filtros
    """
    try:
        # Parâmetros de filtro
        sala_id = request.GET.get('sala')
        ilha_id = request.GET.get('ilha')
        status = request.GET.get('status')
        loja_id = request.GET.get('loja')
        
        # Query base
        query = PosicaoAtendimento.objects.all().select_related('sala', 'ilha')
        
        # Aplicar filtros
        if sala_id:
            query = query.filter(sala_id=sala_id)
        if ilha_id:
            query = query.filter(ilha_id=ilha_id)
        if status:
            query = query.filter(status=status)
        if loja_id:
            try:
                loja_selecionada = int(loja_id)
                query = query.filter(sala__loja_id=loja_selecionada)
            except (ValueError, TypeError):
                pass
        
        # Paginação
        page = int(request.GET.get('page', 1))
        itens_por_pagina = int(request.GET.get('per_page', 20))
        
        # Ordenação
        order_by = request.GET.get('order_by', 'numero')
        if order_by.startswith('-'):
            order_by = order_by[1:]
            order_direction = '-'
        else:
            order_direction = ''
            
        # Verificar se o campo de ordenação é válido
        campos_validos = ['id', 'numero', 'sala__nome', 'ilha__nome', 'status']
        if order_by not in campos_validos:
            order_by = 'numero'
            
        query = query.order_by(f'{order_direction}{order_by}')
        
        # Executar paginação
        paginator = Paginator(query, itens_por_pagina)
        page_obj = paginator.get_page(page)
        
        # Obter funcionários atribuídos às PAs da página atual
        pa_ids = [pa.id for pa in page_obj]
        funcionarios_por_pa = {}
        atribuicoes_funcionarios = AtribuicaoFuncionarioPA.objects.filter(
            ativo=True,
            posicao_atendimento_id__in=pa_ids
        ).select_related('funcionario', 'posicao_atendimento')
        
        for atr_func in atribuicoes_funcionarios:
            funcionarios_por_pa[atr_func.posicao_atendimento_id] = atr_func.funcionario
        
        # Formatar resposta
        pas_data = []
        for pa in page_obj:
            # Obter periféricos atribuídos a esta PA
            perifericos = AtribuicaoPerifericoPA.objects.filter(
                posicao_atendimento=pa, 
                ativo=True
            ).select_related('periferico', 'periferico__tipo')
            
            perifericos_data = []
            for atribuicao in perifericos:
                perifericos_data.append({
                    'id': atribuicao.periferico.id,
                    'tipo': atribuicao.periferico.tipo.nome,
                    'marca': atribuicao.periferico.marca,
                    'modelo': atribuicao.periferico.modelo
                })
            
            # Obter computadores atribuídos a esta PA
            computadores = AtribuicaoComputadorPA.objects.filter(
                posicao_atendimento=pa, 
                ativo=True
            ).select_related('computador')
            
            computadores_data = []
            for atribuicao in computadores:
                computadores_data.append({
                    'id': atribuicao.computador.id,
                    'marca': atribuicao.computador.marca
                })
            
            pas_data.append({
                'id': pa.id,
                'numero': pa.numero,
                'sala': {
                    'id': pa.sala.id,
                    'nome': pa.sala.nome
                } if pa.sala else None,
                'ilha': {
                    'id': pa.ilha.id,
                    'nome': pa.ilha.nome
                } if pa.ilha else None,
                'status': pa.status,
                'status_display': pa.get_status_display(),
                'funcionario': {
                    'id': funcionarios_por_pa[pa.id].id,
                    'nome': funcionarios_por_pa[pa.id].nome_completo
                } if pa.id in funcionarios_por_pa else None,
                'perifericos': perifericos_data,
                'computadores': computadores_data
            })
        
        # Metadados de paginação
        pagination = {
            'page': page,
            'per_page': itens_por_pagina,
            'total_items': paginator.count,
            'total_pages': paginator.num_pages,
            'has_previous': page_obj.has_previous(),
            'has_next': page_obj.has_next(),
            'previous_page': page_obj.previous_page_number() if page_obj.has_previous() else None,
            'next_page': page_obj.next_page_number() if page_obj.has_next() else None,
        }
        
        return JsonResponse({
            'success': True,
            'data': pas_data,
            'pagination': pagination
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# APIs para AJAX


@require_GET
@login_required
def api_get_lojas(request):
    """API GET para retornar todas as lojas ativas."""
    if request.method != 'GET':
        return JsonResponse({
            'success': False,
            'message': 'Método não permitido. Use GET.'
        }, status=405)
    
    try:
        lojas_data = list(
            Loja.objects.filter(status=True)
            .values('id', 'nome')
            .order_by('nome')
        )
        
        response_data = {
            'success': True,
            'data': {
                'lojas': lojas_data,
                'total': len(lojas_data)
            },
            'message': 'Lojas carregadas com sucesso.'
        }
        
        return JsonResponse(response_data)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao carregar lojas: {str(e)}'
        }, status=500)

@login_required
def api_get_salas_por_loja(request, loja_id):
    """API GET para retornar salas de uma loja específica."""
    if request.method != 'GET':
        return JsonResponse({
            'success': False,
            'message': 'Método não permitido. Use GET.'
        }, status=405)
    
    try:
        # Validar se a loja existe
        if not Loja.objects.filter(id=loja_id, status=True).exists():
            return JsonResponse({
                'success': False,
                'message': 'Loja não encontrada ou inativa.'
            }, status=404)
        
        salas_data = list(
            Sala.objects.filter(loja_id=loja_id)
            .values('id', 'nome')
            .order_by('nome')
        )
        
        response_data = {
            'success': True,
            'data': {
                'salas': salas_data,
                'total': len(salas_data),
                'loja_id': loja_id
            },
            'message': 'Salas carregadas com sucesso.'
        }
        
        return JsonResponse(response_data)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao carregar salas: {str(e)}'
        }, status=500)

# ================================
# Views AJAX para formulários
# ================================

@login_required
def api_post_periferico_create(request):
    """API POST para cadastrar periférico(s)."""
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'message': 'Método não permitido. Use POST.'
        }, status=405)
    
    try:
        # Verificar se é um envio em lote
        if 'perifericos_lote' in request.POST:
            return _processar_perifericos_lote(request)
        
        # Processo normal (formulário individual)
        return _processar_periferico_individual(request)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro interno: {str(e)}'
        }, status=500)

def _processar_perifericos_lote(request):
    """Processa cadastro de periféricos em lote."""
    try:
        perifericos_lote = json.loads(request.POST.get('perifericos_lote', '[]'))
        if not perifericos_lote:
            return JsonResponse({
                'success': False,
                'message': 'Nenhum periférico para cadastrar.'
            })
        
        resultado = {
            'total_cadastrados': 0,
            'erros': []
        }
        
        for item in perifericos_lote:
            _processar_item_lote(item, resultado)
        
        return _gerar_resposta_lote(resultado)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'message': 'Formato JSON inválido.'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao processar lote: {str(e)}'
        })

def _processar_item_lote(item, resultado):
    """Processa um item individual do lote."""
    try:
        dados_item = {
            'tipo_id': item.get('tipo_id'),
            'marca': item.get('marca', '').strip(),
            'modelo': item.get('modelo', '').strip(),
            'data_aquisicao': item.get('data_aquisicao'),
            'loja_id': item.get('loja_id'),
            'quantidade': item.get('quantidade', 1)
        }
        
        if not all([dados_item['tipo_id'], dados_item['marca'], 
                   dados_item['modelo'], dados_item['loja_id']]):
            resultado['erros'].append(
                f"Dados incompletos para periférico: {dados_item['marca']} {dados_item['modelo']}"
            )
            return
        
        # Processar data de aquisição
        if dados_item['data_aquisicao']:
            try:
                dados_item['data_aquisicao'] = timezone.datetime.strptime(
                    dados_item['data_aquisicao'], '%Y-%m-%d'
                ).date()
            except (ValueError, TypeError):
                dados_item['data_aquisicao'] = None
        
        # Criar periféricos
        for _ in range(dados_item['quantidade']):
            periferico = Periferico(
                tipo_id=dados_item['tipo_id'],
                marca=dados_item['marca'],
                modelo=dados_item['modelo'],
                data_aquisicao=dados_item['data_aquisicao'],
                loja_id=dados_item['loja_id'],
                quantidade=1,
                status='disponivel'
            )
            periferico.save()
            resultado['total_cadastrados'] += 1
            
    except Exception as e:
        resultado['erros'].append(
            f"Erro ao cadastrar {dados_item.get('marca', '')} {dados_item.get('modelo', '')}: {str(e)}"
        )

def _gerar_resposta_lote(resultado):
    """Gera resposta para processamento em lote."""
    if resultado['total_cadastrados'] > 0:
        message = f"{resultado['total_cadastrados']} periférico(s) cadastrado(s) com sucesso!"
        if resultado['erros']:
            message += f" ({len(resultado['erros'])} erro(s) encontrado(s))"
        
        return JsonResponse({
            'success': True,
            'message': message,
            'data': {
                'total_cadastrados': resultado['total_cadastrados'],
                'total_erros': len(resultado['erros']),
                'erros': resultado['erros']
            }
        })
    else:
        return JsonResponse({
            'success': False,
            'message': 'Nenhum periférico foi cadastrado devido a erros.',
            'data': {
                'erros': resultado['erros']
            }
        })

def _processar_periferico_individual(request):
    """Processa cadastro de periférico individual."""
    form = PerifericoForm(request.POST)
    if not form.is_valid():
        errors = []
        for field, error_list in form.errors.items():
            for error in error_list:
                errors.append(f"{field}: {error}")
        
        return JsonResponse({
            'success': False,
            'message': 'Erro de validação: ' + '; '.join(errors)
        })
    
    quantidade = min(form.cleaned_data.get('quantidade', 1), 100)
    
    if quantidade > 1:
        return _criar_multiplos_perifericos(form, quantidade)
    else:
        form.save()
        return JsonResponse({
            'success': True,
            'message': 'Periférico cadastrado com sucesso!'
        })

def _criar_multiplos_perifericos(form, quantidade):
    """Cria múltiplos periféricos baseado no formulário."""
    modelo_base = form.save(commit=False)
    
    dados_base = {
        'tipo': modelo_base.tipo,
        'marca': modelo_base.marca,
        'modelo': modelo_base.modelo,
        'data_aquisicao': modelo_base.data_aquisicao,
        'loja': modelo_base.loja,
        'status': modelo_base.status,
        'observacoes': modelo_base.observacoes
    }
    
    # Salvar o primeiro
    modelo_base.quantidade = 1
    modelo_base.save()
    perif_criados = 1
    
    # Criar os demais
    for _ in range(1, quantidade):
        periferico = Periferico(
            tipo=dados_base['tipo'],
            marca=dados_base['marca'],
            modelo=dados_base['modelo'],
            data_aquisicao=dados_base['data_aquisicao'],
            quantidade=1,
            loja=dados_base['loja'],
            status=dados_base['status'],
            observacoes=dados_base['observacoes']
        )
        periferico.save()
        perif_criados += 1
    
    return JsonResponse({
        'success': True,
        'message': f'{perif_criados} periféricos cadastrados com sucesso!',
        'data': {
            'total_criados': perif_criados
        }
    })

# ===== VIEWS PARA CONTROLE DE E-MAILS =====

@login_required
def controle_emails(request):
    """
    View principal para o controle de e-mails.
    Exibe dashboard com estatísticas e lista de e-mails.
    """
    # Obter estatísticas dos e-mails
    total_emails = Email.objects.count()
    emails_ativos = Email.objects.filter(status='ativo').count()
    emails_inativos = Email.objects.filter(status='inativo').count()
    emails_funcionario_desligado = Email.objects.filter(status='funcionario_desligado').count()
    
    # Obter lista de funcionários para os selects
    funcionarios = Funcionario.objects.filter(status=True).order_by('nome_completo')
    
    # Obter todos os e-mails com relacionamentos carregados
    emails = Email.objects.select_related('ramal', 'setor').all().order_by('email')
    
    context = {
        'title': 'Controle de E-mails - TI',
        'total_emails': total_emails,
        'emails_ativos': emails_ativos,
        'emails_inativos': emails_inativos,
        'emails_funcionario_desligado': emails_funcionario_desligado,
        'funcionarios': funcionarios,
        'emails': emails,
        'form': EmailForm(),
    }
    
    return render(request, 'ti/controle_emails.html', context)

@login_required
def email_create(request):
    """View para criar um novo e-mail"""
    if request.method == 'POST':
        form = EmailForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'E-mail cadastrado com sucesso!')
            return redirect('ti:controle_emails')
        else:
            messages.error(request, 'Erro ao cadastrar e-mail. Verifique os dados informados.')
    else:
        form = EmailForm()
    
    context = {
        'title': 'Cadastrar E-mail',
        'form': form,
        'funcionarios': Funcionario.objects.filter(status=True).order_by('nome_completo'),
    }
    
    return render(request, 'ti/email_form.html', context)

@login_required
def email_update(request, pk):
    """View para editar um e-mail existente"""
    email = get_object_or_404(Email, pk=pk)
    
    if request.method == 'POST':
        form = EmailForm(request.POST, instance=email)
        if form.is_valid():
            form.save()
            messages.success(request, 'E-mail atualizado com sucesso!')
            return redirect('ti:controle_emails')
        else:
            messages.error(request, 'Erro ao atualizar e-mail. Verifique os dados informados.')
    else:
        form = EmailForm(instance=email)
    
    context = {
        'title': 'Editar E-mail',
        'form': form,
        'email': email,
        'funcionarios': Funcionario.objects.filter(status=True).order_by('nome_completo'),
    }
    
    return render(request, 'ti/email_form.html', context)

@login_required
def email_delete(request, pk):
    """View para excluir um e-mail"""
    email = get_object_or_404(Email, pk=pk)
    
    if request.method == 'POST':
        email.delete()
        messages.success(request, 'E-mail excluído com sucesso!')
        return redirect('ti:controle_emails')
    
    context = {
        'title': 'Excluir E-mail',
        'email': email,
    }
    
    return render(request, 'apps/ti/confirm_delete.html', context)

@login_required
def api_get_emails_data(request):
    """
    API GET para retornar dados dos e-mails em formato JSON.
    Usado para carregar dados dinamicamente na tabela.
    """
    if request.method != 'GET':
        return JsonResponse({
            'success': False,
            'message': 'Método não permitido. Use GET.'
        }, status=405)
    
    try:
        # Obter parâmetros de busca
        filtros = {
            'search': request.GET.get('search', '').strip(),
            'status': request.GET.get('status', '').strip()
        }
        
        # Query base com relacionamentos otimizados
        emails_queryset = Email.objects.select_related(
            'ramal', 'funcionario', 'setor'
        ).all()
        
        # Aplicar filtros
        emails_queryset = _aplicar_filtros_emails(emails_queryset, filtros)
        
        # Ordenar por e-mail
        emails_queryset = emails_queryset.order_by('email')
        
        # Preparar dados para JSON
        emails_data = [_serializar_email(email) for email in emails_queryset]
        
        response_data = {
            'success': True,
            'data': {
                'emails': emails_data,
                'total': len(emails_data),
                'filtros_aplicados': filtros
            },
            'message': 'E-mails carregados com sucesso.'
        }
        
        return JsonResponse(response_data)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao carregar e-mails: {str(e)}'
        }, status=500)

def _aplicar_filtros_emails(queryset, filtros):
    """Aplica filtros na consulta de e-mails."""
    if filtros['search']:
        queryset = queryset.filter(
            Q(email__icontains=filtros['search']) |
            Q(ramal__nome_completo__icontains=filtros['search']) |
            Q(funcionario__nome_completo__icontains=filtros['search']) |
            Q(setor__nome_completo__icontains=filtros['search'])
        )
    
    if filtros['status']:
        queryset = queryset.filter(status=filtros['status'])
    
    return queryset

def _serializar_email(email):
    """Serializa um objeto Email para JSON."""
    # Determinar ramal
    ramal_info = _obter_ramal_info(email)
    
    # Determinar funcionário principal
    funcionario_nome = _obter_funcionario_nome(email)
    
    # Determinar setor
    setor_nome = _obter_setor_nome(email)
    
    return {
        'id': email.id,
        'email': email.email,
        'status': email.get_status_display(),
        'status_value': email.status,
        'ramal': ramal_info or '-',
        'funcionario': funcionario_nome,
        'setor': setor_nome,
        'senha': email.senha if email.senha else None,
        'email_recuperacao': email.email_recuperacao or '-',
        'data_criacao': email.data_criacao.strftime('%d/%m/%Y %H:%M') if email.data_criacao else '-',
    }

def _obter_ramal_info(email):
    """Obtém informações do ramal do e-mail."""
    if not email.ramal:
        return None
    
    try:
        from apps.funcionarios.models import Funcionario
        funcionario = Funcionario.objects.get(id=email.ramal.id)
        return getattr(funcionario, 'ramal', None)
    except Exception:
        return None

def _obter_funcionario_nome(email):
    """Obtém o nome do funcionário associado ao e-mail."""
    if email.funcionario:
        return email.funcionario.nome_completo
    elif email.ramal:
        return email.ramal.nome_completo
    return '-'

def _obter_setor_nome(email):
    """Obtém o nome do setor associado ao e-mail."""
    if email.funcionario and hasattr(email.funcionario, 'setor') and email.funcionario.setor:
        return email.funcionario.setor.nome
    elif email.ramal and hasattr(email.ramal, 'setor') and email.ramal.setor:
        return email.ramal.setor.nome
    elif email.setor:
        return email.setor.nome_completo
    return '-'

@login_required
def api_post_email_create(request):
    """API POST para cadastrar e-mail"""
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'message': 'Método não permitido. Use POST.'
        }, status=405)
    
    try:
        form = EmailForm(request.POST)
        if form.is_valid():
            email_obj = form.save()
            
            response_data = {
                'success': True,
                'data': {
                    'email_id': email_obj.id,
                    'email': email_obj.email,
                    'status': email_obj.get_status_display()
                },
                'message': 'E-mail cadastrado com sucesso!'
            }
            
            return JsonResponse(response_data, status=201)
        else:
            # Processar erros do formulário
            erros_formatados = _processar_erros_formulario(form.errors)
            
            return JsonResponse({
                'success': False,
                'message': f'Erro de validação: {erros_formatados}',
                'errors': dict(form.errors)
            }, status=400)
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao cadastrar e-mail: {str(e)}'
        }, status=500)

def _processar_erros_formulario(form_errors):
    """Processa e formata os erros do formulário."""
    erros = []
    for field, error_list in form_errors.items():
        for error in error_list:
            erros.append(f"{field}: {error}")
    return '; '.join(erros)

@login_required
def api_post_atualizar_status_email(request):
    """API POST para atualizar o status de um e-mail"""
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'message': 'Método não permitido. Use POST.'
        }, status=405)
    
    try:
        # Extrair dados da requisição
        dados_atualizacao = {
            'email_id': request.POST.get('email_id'),
            'novo_status': request.POST.get('status')
        }
        
        # Validar dados obrigatórios
        validacao = _validar_dados_status_email(dados_atualizacao)
        if not validacao['valido']:
            return JsonResponse({
                'success': False,
                'message': validacao['mensagem']
            }, status=400)
        
        # Buscar e atualizar o e-mail
        try:
            email = Email.objects.get(id=dados_atualizacao['email_id'])
            status_anterior = email.status
            email.status = dados_atualizacao['novo_status']
            email.save()
            
            # Obter mapeamento de status
            status_validos = _obter_status_validos_email()
            
            response_data = {
                'success': True,
                'data': {
                    'email_id': email.id,
                    'status_anterior': status_anterior,
                    'status_novo': email.status,
                    'status_display': status_validos[email.status]
                },
                'message': f'Status do e-mail atualizado para {status_validos[email.status]}'
            }
            
            return JsonResponse(response_data)
            
        except Email.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': 'E-mail não encontrado'
            }, status=404)
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao atualizar status do e-mail: {str(e)}'
        }, status=500)

def _validar_dados_status_email(dados):
    """Valida os dados para atualização de status do e-mail."""
    if not dados['email_id']:
        return {'valido': False, 'mensagem': 'ID do e-mail é obrigatório.'}
    
    if not dados['novo_status']:
        return {'valido': False, 'mensagem': 'Novo status é obrigatório.'}
    
    # Validar se o status é válido
    status_validos = _obter_status_validos_email()
    if dados['novo_status'] not in status_validos:
        return {'valido': False, 'mensagem': f'Status inválido: {dados["novo_status"]}'}
    
    return {'valido': True, 'mensagem': ''}

def _obter_status_validos_email():
    """Retorna o mapeamento de status válidos para e-mails."""
    return {
        'ativo': 'Em uso',
        'funcionario_desligado': 'Func desligado',
        'sem_senha': 'Sem senha',
        'sem_recuperacao': 'Sem n° recup',
        'renovado': 'renovado',
        'inativo': 'sem uso'
    }

@login_required 
@require_POST
def api_post_computador_create_ajax(request):
    """API POST para cadastrar computador via AJAX."""
    try:
        form = ComputadorForm(request.POST)
        if not form.is_valid():
            errors = []
            for field, error_list in form.errors.items():
                for error in error_list:
                    errors.append(f"{field}: {error}")
            
            response_data = build_response_data(
                success=False,
                error='Erro de validação: ' + '; '.join(errors)
            )
            return JsonResponse(response_data, status=400)
        
        computador = form.save(commit=False)
        status = form.cleaned_data['status']
        
        # Processar diferentes status
        if status == 'em_uso':
            response_data = _processar_computador_em_uso(computador, request)
        elif status == 'manutencao':
            response_data = _processar_computador_manutencao(computador, request)
        else:
            computador.save()
            response_data = build_response_data(
                success=True,
                message='Computador cadastrado com sucesso!',
                data={'computador_id': computador.id}
            )
        
        return JsonResponse(response_data)
        
    except Exception as e:
        response_data = build_response_data(
            success=False,
            error=f'Erro interno: {str(e)}'
        )
        return JsonResponse(response_data, status=500)


def _processar_computador_em_uso(computador, request):
    """Processa computador com status 'em_uso'."""
    pa_id = request.POST.get('pa_em_uso')
    computador.save()
    
    if not pa_id:
        return build_response_data(
            success=True,
            message='Computador cadastrado com sucesso.',
            data={'computador_id': computador.id}
        )
    
    try:
        pa = PosicaoAtendimento.objects.get(id=pa_id)
        AtribuicaoComputadorPA.objects.create(
            computador=computador,
            posicao_atendimento=pa,
            data_atribuicao=timezone.now(),
            ativo=True
        )
        return build_response_data(
            success=True,
            message=f'Computador cadastrado e atribuído à PA {pa.numero} com sucesso!',
            data={
                'computador_id': computador.id,
                'pa_id': pa.id,
                'pa_numero': pa.numero
            }
        )
    except PosicaoAtendimento.DoesNotExist:
        return build_response_data(
            success=True,
            message='Computador cadastrado, mas PA não encontrada.',
            data={'computador_id': computador.id}
        )


def _processar_computador_manutencao(computador, request):
    """Processa computador com status 'manutencao'."""
    observacoes_manutencao = request.POST.get('observacoes_manutencao')
    if observacoes_manutencao:
        computador.observacoes = f"MANUTENÇÃO: {observacoes_manutencao}"
    
    computador.save()
    
    return build_response_data(
        success=True,
        message='Computador cadastrado e enviado para manutenção com sucesso!',
        data={
            'computador_id': computador.id,
            'observacoes': computador.observacoes
        }
    )

@login_required
def api_post_sala_create(request):
    """
    API POST para cadastrar sala.
    
    Args:
        request: HttpRequest com dados do formulário
    
    Returns:
        JsonResponse com resultado da operação
    """
    if request.method != 'POST':
        return JsonResponse(
            build_response_data(False, error='Método não permitido'),
            status=405
        )
    
    try:
        form = SalaForm(request.POST)
        if not form.is_valid():
            errors = []
            for field, error_list in form.errors.items():
                for error in error_list:
                    errors.append(f"{field}: {error}")
            return JsonResponse(
                build_response_data(False, error=f'Erro de validação: {"; ".join(errors)}'),
                status=400
            )
        
        sala = form.save()
        
        # Dados da sala criada para resposta
        sala_data = {
            'id': sala.id,
            'nome': sala.nome,
            'loja': sala.loja.nome if sala.loja else None
        }
        
        return JsonResponse(
            build_response_data(
                True, 
                message='Sala cadastrada com sucesso!',
                sala=sala_data
            )
        )
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao cadastrar sala: {str(e)}", exc_info=True)
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

@login_required
def api_post_ilha_create(request):
    """
    API POST para cadastrar ilha.
    
    Args:
        request: HttpRequest com dados do formulário
    
    Returns:
        JsonResponse com resultado da operação
    """
    if request.method != 'POST':
        return JsonResponse(
            build_response_data(False, error='Método não permitido'),
            status=405
        )
    
    try:
        form = IlhaForm(request.POST)
        if not form.is_valid():
            errors = []
            for field, error_list in form.errors.items():
                for error in error_list:
                    errors.append(f"{field}: {error}")
            return JsonResponse(
                build_response_data(False, error=f'Erro de validação: {"; ".join(errors)}'),
                status=400
            )
        
        ilha = form.save()
        
        # Dados da ilha criada para resposta
        ilha_data = {
            'id': ilha.id,
            'nome': ilha.nome,
            'sala': {
                'id': ilha.sala.id,
                'nome': ilha.sala.nome
            } if ilha.sala else None
        }
        
        return JsonResponse(
            build_response_data(
                True, 
                message='Ilha cadastrada com sucesso!',
                ilha=ilha_data
            )
        )
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao cadastrar ilha: {str(e)}", exc_info=True)
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

@login_required
def api_post_posicao_atendimento_create(request):
    """
    API POST para cadastrar posição(ões) de atendimento.
    
    Args:
        request: HttpRequest com dados do formulário
    
    Returns:
        JsonResponse com resultado da operação
    """
    if request.method != 'POST':
        return JsonResponse(
            build_response_data(False, error='Método não permitido'),
            status=405
        )
    
    try:
        form = PosicaoAtendimentoForm(request.POST)
        if not form.is_valid():
            errors = []
            for field, error_list in form.errors.items():
                for error in error_list:
                    errors.append(f"{field}: {error}")
            return JsonResponse(
                build_response_data(False, error=f'Erro de validação: {"; ".join(errors)}'),
                status=400
            )
        
        # Obter quantidade de PAs a serem criadas
        quantidade_pas = form.cleaned_data.get('quantidade_pas', 1)
        pa_base = form.save(commit=False)
        
        # Dados base para criação das PAs
        pa_base_data = {
            'titulo': pa_base.titulo,
            'ilha': pa_base.ilha,
            'sala': pa_base.sala,
            'status': pa_base.status,
            'observacoes': pa_base.observacoes
        }
        
        pas_criadas = []
        
        for i in range(quantidade_pas):
            if i == 0:
                # Primeira PA usa a instância do formulário
                pa = pa_base
            else:
                # PAs subsequentes são novas instâncias
                pa = PosicaoAtendimento(**pa_base_data)
            
            # Deixar o model gerar o número automaticamente
            pa.numero = None
            pa.save()
            
            # Dados da PA criada
            pa_info = {
                'id': pa.id,
                'numero': pa.numero,
                'titulo': pa.titulo,
                'sala': pa.sala.nome if pa.sala else None,
                'ilha': pa.ilha.nome if pa.ilha else None,
                'status': pa.status
            }
            pas_criadas.append(pa_info)
        
        # Configurar mensagem de resposta
        message_config = {
            'single': 'PA {numero} cadastrada com sucesso!',
            'multiple': '{quantidade} PAs cadastradas com sucesso: {numeros}'
        }
        
        if quantidade_pas == 1:
            mensagem = message_config['single'].format(numero=pas_criadas[0]['numero'])
        else:
            numeros_pas = [str(pa['numero']) for pa in pas_criadas]
            mensagem = message_config['multiple'].format(
                quantidade=quantidade_pas,
                numeros=', '.join(numeros_pas)
            )
        
        return JsonResponse(
            build_response_data(
                True,
                message=mensagem,
                pas_criadas=pas_criadas,
                quantidade=quantidade_pas
            )
        )
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao cadastrar posição de atendimento: {str(e)}", exc_info=True)
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

@login_required
def api_post_tipo_periferico_create(request):
    """
    API POST para cadastrar tipo de periférico.
    
    Args:
        request: HttpRequest com dados do formulário
    
    Returns:
        JsonResponse com resultado da operação
    """
    if request.method != 'POST':
        return JsonResponse(
            build_response_data(False, error='Método não permitido'),
            status=405
        )
    
    try:
        form = TipoPerifericoForm(request.POST)
        if not form.is_valid():
            errors = []
            for field, error_list in form.errors.items():
                for error in error_list:
                    errors.append(f"{field}: {error}")
            return JsonResponse(
                build_response_data(False, error=f'Erro de validação: {"; ".join(errors)}'),
                status=400
            )
        
        tipo_periferico = form.save()
        
        # Dados do tipo de periférico criado para resposta
        tipo_data = {
            'id': tipo_periferico.id,
            'nome': tipo_periferico.nome,
            'descricao': tipo_periferico.descricao if hasattr(tipo_periferico, 'descricao') else None
        }
        
        return JsonResponse(
            build_response_data(
                True,
                message='Tipo de Periférico cadastrado com sucesso!',
                tipo_periferico=tipo_data
            )
        )
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao cadastrar tipo de periférico: {str(e)}", exc_info=True)
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

@login_required
def api_post_monitor_create(request):
    """
    API POST para cadastrar monitor.
    
    Args:
        request: HttpRequest com dados do formulário
    
    Returns:
        JsonResponse com resultado da operação
    """
    if request.method != 'POST':
        return JsonResponse(
            build_response_data(False, error='Método não permitido'),
            status=405
        )
    
    try:
        form = MonitorForm(request.POST)
        if not form.is_valid():
            errors = []
            for field, error_list in form.errors.items():
                for error in error_list:
                    errors.append(f"{field}: {error}")
            return JsonResponse(
                build_response_data(False, error=f'Erro de validação: {"; ".join(errors)}'),
                status=400
            )
        
        monitor = form.save()
        
        # Dados do monitor criado para resposta
        monitor_data = {
            'id': monitor.id,
            'marca': monitor.marca if hasattr(monitor, 'marca') else None,
            'modelo': monitor.modelo if hasattr(monitor, 'modelo') else None,
            'tamanho': monitor.tamanho if hasattr(monitor, 'tamanho') else None,
            'status': monitor.status if hasattr(monitor, 'status') else None,
            'loja': monitor.loja.nome if hasattr(monitor, 'loja') and monitor.loja else None
        }
        
        return JsonResponse(
            build_response_data(
                True,
                message='Monitor cadastrado com sucesso!',
                monitor=monitor_data
            )
        )
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao cadastrar monitor: {str(e)}", exc_info=True)
        return JsonResponse(
            build_response_data(False, error=f'Erro interno: {str(e)}'),
            status=500
        )

# Views para Controle de Chips
@login_required
def controle_chips(request):
    """
    View principal para o controle de chips.
    Exibe dashboard com estatísticas e lista de chips.
    """
    # Obter estatísticas dos chips
    total_chips = Chip.objects.count()
    chips_ativos = Chip.objects.filter(status='ativo').count()
    chips_livres = Chip.objects.filter(status='livre').count()
    chips_banidos = Chip.objects.filter(status='banido').count()
    chips_inativos = Chip.objects.filter(status='inativo').count()
    chips_reutilizados = Chip.objects.filter(status='reutilizado').count()
    
    # Obter lista de funcionários para os selects
    funcionarios = Funcionario.objects.filter(status=True).order_by('nome_completo')
    
    # Obter todos os setores ativos para o dropdown
    setores = Setor.objects.filter(status=True).order_by('nome')
    
    # Obter todos os chips com relacionamentos carregados
    chips = Chip.objects.select_related('ramal', 'setor').all().order_by('numero')
    
    context = {
        'title': 'Controle de Chips - TI',
        'total_chips': total_chips,
        'chips_ativos': chips_ativos,
        'chips_livres': chips_livres,
        'chips_banidos': chips_banidos,
        'chips_inativos': chips_inativos,
        'chips_reutilizados': chips_reutilizados,
        'funcionarios': funcionarios,
        'setores': setores,
        'chips': chips,
        'form': ChipForm(),
    }
    
    return render(request, 'ti/controle_chips.html', context)

@login_required
def controle_acessos(request):
    """
    View principal para o controle de acessos.
    Exibe dashboard com dados carregados via JavaScript.
    """
    context = {
        'title': 'Controle de Acessos - TI',
    }
    
    return render(request, 'ti/controle_acessos.html', context)

@require_GET
@login_required
def api_get_controle_acessos_dados(request):
    """
    API endpoint para fornecer dados de controle de acessos em formato JSON.
    Retorna dados de Storm e Sistema para serem carregados via JavaScript.
    """
    try:
        # Obter a loja selecionada, se houver
        loja_id = request.GET.get('loja')
        loja_selecionada = None
        
        # Filtrar por loja, se for selecionada
        if loja_id:
            try:
                loja_selecionada = int(loja_id)
            except (ValueError, TypeError):
                loja_selecionada = None
        
        # Filtro opcional por loja - não força seleção de loja
        filtro_funcionario = {'funcionario__status': True}
        if loja_selecionada:
            filtro_funcionario['funcionario__loja_id'] = loja_selecionada
        
        # Obter dados Storm com relacionamentos
        storm_queryset = Storm.objects.select_related(
            'funcionario', 'funcionario__setor', 'funcionario__cargo'
        ).filter(**filtro_funcionario).order_by('funcionario__nome_completo')
        
        # Obter dados Sistema com relacionamentos
        sistema_queryset = Sistema.objects.select_related(
            'funcionario', 'funcionario__setor', 'funcionario__cargo', 
            'funcionario__departamento'
        ).filter(**filtro_funcionario).order_by('funcionario__nome_completo')
        
        # Serializar dados Storm
        storm_data = []
        for storm in storm_queryset:
            storm_data.append({
                'id': storm.id,
                'funcionario': {
                    'nome_completo': storm.funcionario.nome_completo if storm.funcionario else None,
                    'cpf': storm.funcionario.cpf if storm.funcionario else None,
                    'ramal': storm.funcionario.ramal_ti.numero if storm.funcionario and storm.funcionario.ramal_ti else None,
                },
                'email_administrativo': storm.email_administrativo,
                'situacao': storm.situacao,
                'situacao_display': storm.get_situacao_display(),
                'usuario': storm.usuario,
                'senha': storm.senha,
            })
        
        # Serializar dados Sistema
        sistema_data = []
        for sistema in sistema_queryset:
            sistema_data.append({
                'id': sistema.id,
                'funcionario': {
                    'nome_completo': sistema.funcionario.nome_completo if sistema.funcionario else None,
                },
                'acesso': sistema.acesso,
                'senha': sistema.senha,
                'cargo': sistema.cargo,
                'departamento_setor': sistema.departamento_setor,
            })
        
        return JsonResponse({
            'success': True,
            'storm_data': storm_data,
            'sistema_data': sistema_data,
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao carregar dados: {str(e)}'
        }, status=500)

@login_required
def chip_create(request):
    """View para criar um novo chip"""
    if request.method == 'POST':
        form = ChipForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Chip cadastrado com sucesso!')
            return redirect('ti:controle_chips')
        else:
            messages.error(request, 'Erro ao cadastrar chip. Verifique os dados informados.')
    else:
        form = ChipForm()
    
    context = {
        'title': 'Cadastrar Chip',
        'form': form,
        'funcionarios': Funcionario.objects.filter(status=True).order_by('nome_completo'),
    }
    
    return render(request, 'ti/chip_form.html', context)

@login_required
def chip_update(request, pk):
    """View para editar um chip existente"""
    chip = get_object_or_404(Chip, pk=pk)
    
    if request.method == 'POST':
        form = ChipForm(request.POST, instance=chip)
        if form.is_valid():
            form.save()
            messages.success(request, 'Chip atualizado com sucesso!')
            return redirect('ti:controle_chips')
        else:
            messages.error(request, 'Erro ao atualizar chip. Verifique os dados informados.')
    else:
        form = ChipForm(instance=chip)
    
    context = {
        'title': 'Editar Chip',
        'form': form,
        'chip': chip,
        'funcionarios': Funcionario.objects.filter(status=True).order_by('nome_completo'),
    }
    
    return render(request, 'ti/chip_form.html', context)

@login_required
def chip_delete(request, pk):
    """View para excluir um chip"""
    chip = get_object_or_404(Chip, pk=pk)
    
    if request.method == 'POST':
        chip.delete()
        messages.success(request, 'Chip excluído com sucesso!')
        return redirect('ti:controle_chips')
    
    context = {
        'title': 'Excluir Chip',
        'chip': chip,
    }
    
    return render(request, 'apps/ti/confirm_delete.html', context)

@login_required
def api_get_chips_data(request):
    """
    API GET para retornar dados dos chips em formato JSON.
    Usado para carregar dados dinamicamente na tabela.
    """
    if request.method != 'GET':
        return JsonResponse({
            'success': False,
            'message': 'Método não permitido. Use GET.'
        }, status=405)
    
    try:
        print("🔄 Iniciando carregamento de chips...")
        
        # Obter filtros da requisição
        filtros = {
            'status': request.GET.get('status', '').strip(),
            'search': request.GET.get('search', '').strip()
        }
        print(f"📋 Filtros aplicados: {filtros}")
        
        # Query base com relacionamentos otimizados
        chips_queryset = Chip.objects.select_related('funcionario', 'funcionario__setor', 'funcionario__ramal_ti', 'setor').all()
        print(f"📊 Total de chips no banco: {chips_queryset.count()}")
        
        # Aplicar filtros
        chips_queryset = _aplicar_filtros_chips(chips_queryset, filtros)
        print(f"📊 Chips após filtros: {chips_queryset.count()}")
        
        # Ordenar por número
        chips_queryset = chips_queryset.order_by('numero')
        
        # Serializar dados
        chips_data = []
        for chip in chips_queryset:
            try:
                chip_serializado = _serializar_chip(chip)
                chips_data.append(chip_serializado)
            except Exception as e:
                print(f"❌ Erro ao serializar chip {chip.id}: {e}")
                continue
        
        print(f"✅ Chips serializados com sucesso: {len(chips_data)}")
        
        response_data = {
            'success': True,
            'data': {
                'chips': chips_data,
                'total': len(chips_data),
                'filtros_aplicados': filtros
            },
            'message': 'Chips carregados com sucesso.'
        }
        
        return JsonResponse(response_data)
        
    except Exception as e:
        print(f"❌ Erro geral na API de chips: {e}")
        return JsonResponse({
            'success': False,
            'message': f'Erro ao carregar chips: {str(e)}'
        }, status=500)

def _aplicar_filtros_chips(queryset, filtros):
    """Aplica filtros na consulta de chips."""
    if filtros['status']:
        queryset = queryset.filter(status=filtros['status'])
    
    if filtros['search']:
        queryset = queryset.filter(
            Q(numero__icontains=filtros['search']) |
            Q(funcionario__nome_completo__icontains=filtros['search']) |
            Q(setor__nome_completo__icontains=filtros['search'])
        )
    
    return queryset

def _serializar_chip(chip):
    """Serializa um objeto Chip para JSON."""
    try:
        # Obter informações do ramal através da propriedade
        ramal_info = None
        ramal_numero = '-'
        try:
            ramal_info = chip.ramal
            ramal_numero = ramal_info.numero if ramal_info else '-'
        except Exception as e:
            print(f"Erro ao obter ramal para chip {chip.id}: {e}")
            ramal_numero = '-'
        
        # Obter informações do funcionário
        funcionario_nome = '-'
        try:
            funcionario_nome = chip.funcionario.nome_completo if chip.funcionario else '-'
        except Exception as e:
            print(f"Erro ao obter funcionário para chip {chip.id}: {e}")
            funcionario_nome = '-'
        
        # Obter informações do setor - primeiro através do funcionário, depois através do campo setor do chip
        setor_nome = '-'
        try:
            if chip.funcionario and hasattr(chip.funcionario, 'setor') and chip.funcionario.setor:
                setor_nome = chip.funcionario.setor.nome
            elif hasattr(chip, 'setor') and chip.setor:
                setor_nome = chip.setor.nome_completo if hasattr(chip.setor, 'nome_completo') else str(chip.setor)
        except Exception as e:
            print(f"Erro ao obter setor para chip {chip.id}: {e}")
            setor_nome = '-'
        
        # Formatar datas com tratamento de erro
        def formatar_data_segura(data_obj):
            try:
                return data_obj.strftime('%d/%m/%Y') if data_obj else '-'
            except:
                return '-'
        
        return {
            'id': chip.id,
            'numero': chip.numero,
            'status': chip.get_status_display() if hasattr(chip, 'get_status_display') else str(chip.status),
            'status_value': chip.status,
            'ramal': ramal_numero,
            'funcionario': funcionario_nome,
            'setor': setor_nome,
            'data_entrega': formatar_data_segura(getattr(chip, 'data_entrega', None)),
            'data_criacao_recarga': formatar_data_segura(getattr(chip, 'data_criacao_recarga', None)),
            'data_banimento': formatar_data_segura(getattr(chip, 'data_banimento', None)),
        }
    
    except Exception as e:
        print(f"Erro completo ao serializar chip {chip.id if hasattr(chip, 'id') else 'desconhecido'}: {e}")
        # Retornar um objeto básico em caso de erro
        return {
            'id': getattr(chip, 'id', 0),
            'numero': getattr(chip, 'numero', 'N/A'),
            'status': 'Erro',
            'status_value': 'erro',
            'ramal': '-',
            'funcionario': '-',
            'setor': '-',
            'data_entrega': '-',
            'data_criacao_recarga': '-',
            'data_banimento': '-',
        }

@login_required
def api_post_chip_create(request):
    """API POST para cadastrar chip"""
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'message': 'Método não permitido. Use POST.'
        }, status=405)
    
    try:
        form = ChipForm(request.POST)
        if form.is_valid():
            chip_obj = form.save()
            
            response_data = {
                'success': True,
                'data': {
                    'chip_id': chip_obj.id,
                    'numero': chip_obj.numero,
                    'status': chip_obj.get_status_display()
                },
                'message': 'Chip cadastrado com sucesso!'
            }
            
            return JsonResponse(response_data, status=201)
        else:
            # Processar erros do formulário
            erros_formatados = _processar_erros_formulario(form.errors)
            
            return JsonResponse({
                'success': False,
                'message': f'Erro de validação: {erros_formatados}',
                'errors': dict(form.errors)
            }, status=400)
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao cadastrar chip: {str(e)}'
        }, status=500)

@login_required
@require_POST
def api_post_atualizar_status_email_legacy(request):
    """API legacy para atualizar o status de um e-mail (mantida para compatibilidade)"""
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'message': 'Método não permitido. Use POST.',
            'data': None
        }, status=405)
    
    try:
        email_id = request.POST.get('email_id')
        novo_status = request.POST.get('status')
        
        # Validar dados obrigatórios
        if not email_id or not novo_status:
            return JsonResponse({
                'success': False,
                'message': 'Email ID e status são obrigatórios.',
                'data': None
            }, status=400)
        
        # Validar status
        valid_statuses = _obter_status_validos_email()
        if novo_status not in valid_statuses:
            return JsonResponse({
                'success': False,
                'message': 'Status inválido.',
                'data': {'valid_statuses': valid_statuses}
            }, status=400)
        
        # Buscar e atualizar email
        email = Email.objects.get(id=email_id)
        email.status = novo_status
        email.save()
        
        # Obter o display do status
        status_display = dict(Email.status_choices).get(novo_status)
        
        return JsonResponse({
            'success': True,
            'message': 'Status atualizado com sucesso.',
            'data': {
                'email_id': email_id,
                'novo_status': novo_status,
                'status_display': status_display
            }
        })
        
    except Email.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'E-mail não encontrado.',
            'data': None
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro interno do servidor: {str(e)}',
            'data': None
        }, status=500)

@login_required
@require_POST
def api_post_atualizar_status_storm(request, pk):
    """API para atualizar o status de um acesso Storm"""
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'message': 'Método não permitido. Use POST.',
            'data': None
        }, status=405)
    
    try:
        # Buscar Storm
        storm = get_object_or_404(Storm, pk=pk)
        
        # Extrair dados da requisição
        data = json.loads(request.body)
        novo_status = data.get('status')
        
        # Validar dados obrigatórios
        if not novo_status:
            return JsonResponse({
                'success': False,
                'message': 'Status é obrigatório.',
                'data': None
            }, status=400)
        
        # Validar status
        valid_statuses = _obter_status_validos_storm()
        if novo_status not in valid_statuses:
            return JsonResponse({
                'success': False,
                'message': 'Status inválido.',
                'data': {'valid_statuses': valid_statuses}
            }, status=400)
        
        # Atualizar o status do Storm
        storm.situacao = novo_status
        storm.save()
        
        # Obter o display do status
        status_display = dict(Storm.situacao_choices).get(novo_status)
        
        return JsonResponse({
            'success': True,
            'message': 'Status atualizado com sucesso.',
            'data': {
                'storm_id': pk,
                'novo_status': novo_status,
                'status_display': status_display
            }
        })
        
    except Storm.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Acesso Storm não encontrado.',
            'data': None
        }, status=404)
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'message': 'Dados JSON inválidos.',
            'data': None
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro interno do servidor: {str(e)}',
            'data': None
        }, status=500)

def _obter_status_validos_storm():
    """Retorna lista de status válidos para Storm"""
    return [status[0] for status in Storm.situacao_choices]

@login_required
@require_POST
def api_post_atualizar_data_recarga_chip(request, pk):
    """API para atualizar a data de recarga de um chip ou outros campos"""
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'message': 'Método não permitido. Use POST.',
            'data': None
        }, status=405)
    
    try:
        # Buscar chip
        chip = get_object_or_404(Chip, pk=pk)
        
        # Extrair dados da requisição
        data = json.loads(request.body)
        campo = data.get('campo', 'data_criacao_recarga')
        
        # Processar atualização baseada no campo
        if campo in ['data_criacao_recarga', 'data_entrega', 'data_banimento']:
            return _processar_atualizacao_data_chip(chip, data, campo, pk)
        elif campo == 'status':
            return _processar_atualizacao_status_chip(chip, data)
        elif campo == 'setor':
            return _processar_atualizacao_setor_chip(chip, data)
        else:
            return JsonResponse({
                'success': False,
                'message': f'Campo {campo} não reconhecido.',
                'data': {'campos_validos': ['data_criacao_recarga', 'data_entrega', 'data_banimento', 'status', 'setor']}
            }, status=400)
        
    except Chip.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Chip não encontrado.',
            'data': None
        }, status=404)
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'message': 'Dados JSON inválidos.',
            'data': None
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro interno do servidor: {str(e)}',
            'data': None
        }, status=500)

def _processar_atualizacao_data_chip(chip, data, campo, pk):
    """Processa atualização de campos de data do chip"""
    nova_data = data.get('data_recarga')
    
    if not nova_data:
        return JsonResponse({
            'success': False,
            'message': f'Data para o campo {campo} não fornecida.',
            'data': None
        }, status=400)
    
    # Atualizar o campo específico diretamente no banco de dados
    update_data = {campo: nova_data}
    Chip.objects.filter(pk=pk).update(**update_data)
    
    return JsonResponse({
        'success': True,
        'message': f'Campo {campo} atualizado com sucesso!',
        'data': {
            'chip_id': pk,
            'campo': campo,
            'nova_data': nova_data
        }
    })

def _processar_atualizacao_status_chip(chip, data):
    """Processa atualização de status do chip"""
    novo_status = data.get('valor')
    
    if not novo_status:
        return JsonResponse({
            'success': False,
            'message': 'Status não fornecido.',
            'data': None
        }, status=400)
    
    # Validar status
    valid_statuses = [choice[0] for choice in chip._meta.get_field('status').choices]
    if novo_status not in valid_statuses:
        return JsonResponse({
            'success': False,
            'message': 'Status inválido.',
            'data': {'valid_statuses': valid_statuses}
        }, status=400)
    
    # Atualizar o status do chip
    chip.status = novo_status
    chip.save()
    
    return JsonResponse({
        'success': True,
        'message': 'Status atualizado com sucesso.',
        'data': {
            'chip_id': chip.pk,
            'novo_status': novo_status,
            'status_display': chip.get_status_display()
        }
    })

def _processar_atualizacao_setor_chip(chip, data):
    """Processa atualização de setor do chip"""
    novo_setor_id = data.get('valor')
    
    if not novo_setor_id:
        # Se o valor for vazio, remover o setor do ramal
        if chip.ramal:
            chip.ramal.setor = None
            chip.ramal.save()
            return JsonResponse({
                'success': True,
                'message': 'Setor removido com sucesso!',
                'data': {
                    'chip_id': chip.pk,
                    'setor_removido': True
                }
            })
        else:
            return JsonResponse({
                'success': False,
                'message': 'Este chip não possui ramal associado.',
                'data': None
            }, status=400)
    
    try:
        # Buscar o setor pelo ID
        setor = get_object_or_404(Setor, pk=int(novo_setor_id))
        
        # Verificar se o chip tem um ramal associado
        if chip.ramal:
            # Atualizar o setor do ramal
            chip.ramal.setor = setor
            chip.ramal.save()
            return JsonResponse({
                'success': True,
                'message': 'Setor atualizado com sucesso!',
                'data': {
                    'chip_id': chip.pk,
                    'setor_id': setor.pk,
                    'setor_nome': setor.nome if hasattr(setor, 'nome') else str(setor)
                }
            })
        else:
            return JsonResponse({
                'success': False,
                'message': 'Este chip não possui ramal associado.',
                'data': None
            }, status=400)
            
    except (ValueError, Setor.DoesNotExist):
        return JsonResponse({
            'success': False,
            'message': 'Setor inválido.',
            'data': None
        }, status=400)

@require_GET
@login_required
def api_get_tipos_perifericos(request):
    """API GET para retornar todos os tipos de periféricos ativos."""
    if request.method != 'GET':
        return JsonResponse({
            'success': False,
            'message': 'Método não permitido. Use GET.'
        }, status=405)
    
    try:
        tipos_data = list(
            TipoPeriferico.objects.all()
            .values('id', 'nome')
            .order_by('nome')
        )
        
        response_data = {
            'success': True,
            'data': {
                'tipos_perifericos': tipos_data,
                'total': len(tipos_data)
            },
            'message': 'Tipos de periféricos carregados com sucesso.'
        }
        
        return JsonResponse(response_data)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao carregar tipos de periféricos: {str(e)}'
        }, status=500)

@login_required
@require_POST
def api_post_associar_ramal_funcionario(request):
    try:
        data = json.loads(request.body)
        ramal_numero = data.get('ramal_numero')
        funcionario_id = data.get('funcionario_id')

        if not ramal_numero or not funcionario_id:
            return JsonResponse({'success': False, 'error': 'Ramal e Funcionário são obrigatórios.'}, status=400)
        
        if not ramal_numero.isdigit() or len(ramal_numero) != 4:
            return JsonResponse({'success': False, 'error': 'O ramal deve conter exatamente 4 dígitos numéricos.'}, status=400)

        funcionario = Funcionario.objects.get(id=funcionario_id)

        # Verifica se o funcionário já possui um ramal
        if hasattr(funcionario, 'ramal_ti') and funcionario.ramal_ti is not None:
            return JsonResponse({'success': False, 'error': f'O funcionário {funcionario.nome_completo} já possui o ramal {funcionario.ramal_ti.numero}.'}, status=400)
            
        # Tenta encontrar o ramal. Se não existir, cria um novo.
        ramal, created = Ramal.objects.get_or_create(numero=ramal_numero)
        
        # Se o ramal não foi criado agora e já tem um funcionário, significa que está em uso
        if not created and ramal.funcionario is not None:
            return JsonResponse({'success': False, 'error': f'O ramal {ramal.numero} já está associado ao funcionário {ramal.funcionario.nome_completo}.'}, status=400)

        ramal.funcionario = funcionario
        ramal.save()
        
        return JsonResponse({'success': True, 'message': f'Ramal {ramal.numero} associado a {funcionario.nome_completo} com sucesso!'})

    except Funcionario.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Funcionário não encontrado.'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': f'Ocorreu um erro inesperado: {str(e)}'}, status=500)


@login_required
@require_POST
def api_verificar_ramal(request):
    """API para verificar se um ramal já está em uso por outro funcionário"""
    if request.method == 'POST':
        import json
        import logging
        logger = logging.getLogger(__name__)

        try:
            data = json.loads(request.body)
            ramal = data.get('ramal')
            funcionario_id = data.get('funcionario_id')
            
            # Validação básica
            if not ramal or not funcionario_id:
                return JsonResponse({
                    'success': False, 
                    'error': 'Ramal e ID do funcionário são obrigatórios'
                })
            
            # Verificar se o ramal já está atribuído a outro funcionário
            try:
                ramal_obj = Ramal.objects.get(numero=ramal)
                
                # Se o ramal existe e está associado a um funcionário diferente
                if ramal_obj.funcionario and str(ramal_obj.funcionario.id) != funcionario_id:
                    return JsonResponse({
                        'success': False,
                        'error': f'O ramal {ramal} já está associado ao funcionário {ramal_obj.funcionario.nome_completo}',
                        'em_uso': True,
                        'funcionario': {
                            'id': ramal_obj.funcionario.id,
                            'nome': ramal_obj.funcionario.nome_completo
                        }
                    })
                # Se o ramal existe mas está associado ao mesmo funcionário ou a nenhum
                else:
                    return JsonResponse({
                        'success': True,
                        'em_uso': False,
                        'message': 'Ramal disponível para uso'
                    })
            except Ramal.DoesNotExist:
                # Se o ramal não existe, está disponível
                return JsonResponse({
                    'success': True,
                    'em_uso': False,
                    'message': 'Ramal disponível para uso'
                })
                
        except Exception as e:
            logger.error(f"Erro ao verificar ramal: {str(e)}", exc_info=True)
            return JsonResponse({
                'success': False,
                'error': f'Erro ao verificar ramal: {str(e)}'
            }, status=500)
    
    return JsonResponse({
        'success': False,
        'error': 'Método não permitido'
    }, status=405)
