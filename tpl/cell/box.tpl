
<article class="{%= data.style %}">

    {% if (data.hd) { %}
    <header>
        {% if (data.hd_url) { %}
        <a href="{%= data.hd_url %}" class="ck-link">{%= data.hd %}</a>
        {% } else { %}
        <span>{%= data.hd %}</span>
        {% } %}
    </header>
    {% } %}

    <section>{%= data.content %}</section>

    {% if (data.ft) { %}
    <footer>{%= data.ft %}</footer>
    {% } %}

</article>
