'use strict';

function parseGetString(name, query){
    if(name = (new RegExp('[?&]' + encodeURIComponent(name) + '=([^&]*)')).exec(query))
       return decodeURIComponent(name[1]);
    return '';
}

function addPagination() {
    const maxPages = this.nbPages - 1,
        nextPageNumber = this.page + 1;
    let pagination = (this.page > 0) ? `<div class="page-item col-12 col-md-4"><a class="page-link history-link bg-primary text-light" href="?id=${this.page - 1}">Previous</a></div>` : '';
    pagination += (nextPageNumber <= maxPages) ? `<div class="page-item col-12 col-md-4"><a class="page-link history-link bg-primary text-light" href="?id=${nextPageNumber}">Next</a></div>` : '';

    return pagination;
}

class HackerNews {
    constructor() {
        this.definePageType(location.search);
        this.data.url = location.search;
        this.render();
    }

    // вынесено за конструктор, чтобы при навигации по страницам не приходилось пересоздавать экземпляр класса
    requestParams = {
        main: {
            url: 'https://hn.algolia.com/api/v1/search?tags=front_page&page=',
            templates: ['main.mustache']
        },
        article: {
            url: 'https://hn.algolia.com/api/v1/items/',
            templates: ['article.mustache', 'comment.mustache'] 
        } 
        // порядок шаблонов для страницы комментов важен
        // т.к. в рендере главной и страницы статьи есть различия - на странице статьи есть рекурсивный вывод комментов
    }

    data = {} // объект с данными страницы

    contentWrapperElement = document.querySelector('.content-wrapper')
    preloaderElement = document.querySelector('.preloader')
    
    preloaderActive = true

    definePageType(queryString) {
        let pageParam;
        // определяем по переданному параметру тип страницы
        // отсутствие параметра id не исключает факт, что пользователь зашел на главную
        if(pageParam = parseGetString('articleID', queryString)) { 
            this.data.pageType = 'article';
        } else {
            pageParam = parseGetString('id', queryString);
            this.data.pageType = 'main';
        }

        this.data.pageParam = pageParam;
    }

    showPreloader() {
        if(!this.data.preloaderActive) {
            this.preloaderElement.classList.add('active');
            this.contentWrapperElement.classList.remove('active');
            this.preloaderActive = true;
        }
    }

    hidePreloader() {
        this.preloaderElement.classList.remove('active');
        this.contentWrapperElement.classList.add('active');
        this.preloaderActive = false;
    }

    render = async function() {
        this.showPreloader();

        const queryString = this.requestParams[this.data.pageType].url + this.data.pageParam,
            templateSrc = this.requestParams[this.data.pageType].templates;
            
        const res = await axios.get(queryString); // загружаем данные по API
        const loadedContent = res.data;
        if(loadedContent.nbPages) {
            loadedContent.pagination = addPagination;
        }

        let templatePromises = []; // загружаем шаблоны с сервера
        templateSrc.forEach(elem => {
            templatePromises.push(axios.get('templates/' + elem));
        });
        const templates = await Promise.all(templatePromises);

        let partials = {};
        if(templates.length > 1) { 
            // если в массиве присутствует второй шаблон, значит он нужен для рекурсии 
            // (можно переписать под объекты или сделать первый шаблон основным, а остальные - partials)
            
            partials = {child: templates[1].data};
        }
        let render = Mustache.render(templates[0].data, loadedContent, partials); // рендер страницы
        document.querySelector('.content-wrapper').innerHTML = render; // вставка результатов в DOM

        this.data.pageContent = render;
        history.pushState(this.data, null, this.data.url); // сохраняем данные приложения в истории, чтобы в случае возврата
                                                           // на страницу не занимать ресурсы компа очередным рендером
        this.hidePreloader();
    }
}

let app = new HackerNews();

document.addEventListener('click', function(e){
    const link = e.target.closest('.history-link') || e.target; // такой метод позволяет избежать сложной структуры операторов if
                                                                // изначально предполагается, что e.target - это не тот элемент, который мы ищем
                                                                // если же не находится родительский элемент с указанным классом не находится, ставим e.target 
    if(!link.classList.contains('history-link')) return;        // проверяем, содержит ли предполагаемая ссылка нужный класс

    e.preventDefault();
    app.definePageType(link.href);
    app.data.url = link.href;
    app.render();
});

window.addEventListener('popstate', function(e){
    if(history.state) app.data = history.state;
    app.contentWrapperElement.innerHTML = app.data.pageContent;
});
