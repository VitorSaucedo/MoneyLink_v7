from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger

def paginate_queryset(request, queryset, per_page=10):
    """
    Função auxiliar para paginar um queryset.
    
    Args:
        request: O objeto request para obter o número da página atual
        queryset: O queryset a ser paginado
        per_page: Número de itens por página (padrão: 10)
    
    Returns:
        Um objeto de página que contém os objetos da página atual
    """
    paginator = Paginator(queryset, per_page)
    page = request.GET.get('page', 1)
    
    try:
        page_obj = paginator.page(page)
    except PageNotAnInteger:
        # Se a página não for um inteiro, mostra a primeira página
        page_obj = paginator.page(1)
    except EmptyPage:
        # Se a página estiver fora do intervalo, mostra a última página
        page_obj = paginator.page(paginator.num_pages)
    
    return page_obj

def get_pagination_data(page_obj):
    """
    Retorna metadados úteis para a paginação.
    
    Args:
        page_obj: Objeto de página retornado pelo Paginator
    
    Returns:
        Dicionário com metadados da paginação
    """
    return {
        'has_previous': page_obj.has_previous(),
        'has_next': page_obj.has_next(),
        'previous_page_number': page_obj.previous_page_number() if page_obj.has_previous() else None,
        'next_page_number': page_obj.next_page_number() if page_obj.has_next() else None,
        'number': page_obj.number,
        'num_pages': page_obj.paginator.num_pages,
        'start_index': page_obj.start_index(),
        'end_index': page_obj.end_index(),
        'total_items': page_obj.paginator.count,
    }
