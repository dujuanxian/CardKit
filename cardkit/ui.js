
define([
    'mo/lang',
    'dollar',
    'mo/browsers',
    'mo/template',
    'mo/network',
    'soviet',
    'momo/base',
    'momo/tap',
    './ui/control',
    './ui/picker',
    './ui/ranger',
    './ui/modalview',
    './ui/actionview',
    './ui/growl',
    './supports',
    './bus'
], function(_, $, browsers, tpl, net, soviet, 
    momoBase, momoTap,
    control, picker, ranger, 
    modalView, actionView, growl, supports, bus){

var doc = document,
    modalCard = modalView(),
    _modal_tm,
    _soviet_aliases = {},
    _soviet_opt = {
        aliasEvents: _soviet_aliases,
        autoOverride: true,
        matchesSelector: true,
        preventDefault: true
    };

var BrightSoviet = _.construct(soviet.Soviet);

BrightSoviet.prototype.on = function(event, selector, handler){
    if (typeof selector === 'string'
            && !/dd-autogen/.test(selector)) {
        selector = '[dd-autogen] ' + selector;
    }
    return this.superMethod('on', [event, selector, handler]);
};

var DarkSoviet = _.construct(soviet.Soviet);

DarkSoviet.prototype.on = function(event, selector, handler){
    if (typeof selector === 'string'
            && !/dd-connect/.test(selector)) {
        selector = '[dd-connect] ' + selector;
    }
    return this.superMethod('on', [event, selector, handler]);
};

_.mix(momoBase.Class.prototype, {
    bind: function(ev, handler, elm){
        $(elm || this.node).bind(ev, handler);
        return this;
    },
    unbind: function(ev, handler, elm){
        $(elm || this.node).unbind(ev, handler);
        return this;
    },
    trigger: function(e, ev){
        delete e.layerX;
        delete e.layerY;
        delete e.returnValue;
        $(e.target).trigger(ev, e);
        return this;
    }
});

var tap_events = {

    '.ck-link, .ck-link *': function(){
        actions.openLink(this);
    },

    '.ck-link-direct, .ck-link-direct *': function(){ // @deprecated
        actions.openLink(this);
    },

    '.ck-link-extern, ck-link-extern *': function(){
        actions.openLink(this, {
            target: this.target || '_blank'
        });
    },

    '.ck-link-img': function(){
        actions.openImage(this.href);
    },

    // control

    '.ck-post-link': handle_control,

    '.ck-post-button, .ck-post-button span': tap_ck_post,

    '.ck-folder header': function(){
        control(this.parentNode).toggle();
    },

    '.ck-switch, .ck-switch span': tap_ck_switch,

    // picker

    '.ck-segment .ck-option, .ck-segment .ck-option span': function(){
        var btn = $(this);
        if (!btn.hasClass('ck-option')) {
            btn = btn.closest('.ck-option');
        }
        var p = picker(btn.parent());
        p.select(btn);
    },

    '.ck-select, .ck-select span, .ck-select .enabled': function(){
        var me = $(this);
        if (!me.hasClass('ck-select')) {
            me = me.parent();
        }
        var p = picker(me);
        show_actions(me);
        bus.on('actionView:confirmOnThis', function(actionWindow){
            actions.updatePicker(p, actionWindow.val());
            me.trigger('selector:change', {
                component: p
            });
        });
    },

    '.ck-tagselector .ck-option': function(){
        var p = picker(this.parentNode);
        p.select(this);
    },

    '.ck-actions .ck-option': function(){
        var acts = $(this).closest('.ck-actions');
        var p = picker(acts, {
            ignoreStatus: acts.data("ignoreStatus") !== 'false' && true
        });
        p.select(this);
    },

    '.ck-actions-button, .ck-actions-button span': function(){
        var me = $(this);
        if (!me.hasClass('ck-actions-button')) {
            me = me.parent();
        }
        show_actions(me);
    },

    // modalView

    '.ck-modal-button, .ck-modal-button *': function(){
        var me = $(this);
        if (!me.hasClass('ck-modal-button')) {
            me = me.closest('.ck-modal-button');
        }
        actions.openModal(me.data());
    },

    '.ck-modal-link, .ck-modal-link *': function(){
        var me = $(this);
        if (!me.hasClass('ck-modal-link')) {
            me = me.closest('.ck-modal-link');
        }
        actions.openModal(me.data());
    },

    '.ck-modalview .wrapper > header .confirm': function(){
        modalCard.confirm();
    },

    '.ck-modalview .wrapper > header .cancel': function(){
        modalCard.cancel();
    },

    // actionView

    '.ck-actionview .ck-option, .ck-actionview .ck-option > *': function(){
        var me = $(this);
        if (!me.hasClass('ck-option')) {
            me = me.parent();
        }
        actionView.current.select(me);
    },

    '.ck-actionview > footer .confirm': function(){
        actionView.current.confirm();
    },

    '.ck-actionview > footer .cancel': function(){
        actionView.current.cancel();
    },

    '.ck-top-overflow': function(){
        show_actions($(this));
    },

    '.ck-confirm-link': function(){
        var me = this;
        if (!me.href) {
            me = me.parentNode;
        }
        actions.confirm('', function(){
            actions.openLink(me.href, me.target);
        }, $(me).data());
    },

    // growl 

    '.ck-growl-button': function(){
        growl(this).open();
    }

};

bus.on('ranger:changed', function(ranger, url){
    if (url) {
        actions.openLink(tpl.format(url, {
            value: ranger.val()
        }));
    }
});

bus.on('actionView:jump', function(actionCard, href, target){
    actions.openLink(href, {
        target: target
    });
});

var components = {
    control: control,
    picker: picker,
    ranger: ranger,
    modalCard: modalCard,
    modalView: modalView,
    actionView: actionView, 
    growl: growl
};

var actions = {

    alert: function(text, opt) {
        return actionView('ckAlert', _.mix({
            title: '提示',
            content: text || '',
            cancelText: '关闭',
            multiselect: false
        }, opt)).open();
    },

    confirm: function(text, cb, opt) {
        var re = actionView('ckAlert', _.mix({
            title: '提示',
            content: text || '',
            confirmText: '确认',
            cancelText: '取消',
            multiselect: true
        }, opt)).open();
        bus.on('actionView:confirmOnThis', cb);
        return re;
    },

    openModal: function(opt){
        var tm = +new Date(),
            url = opt.jsonUrl || opt.url;
        if (url) {
            actions.showLoading();
            _modal_tm = tm;
            if (opt.jsonUrl) {
                net.getJSON(url, callback);
            } else if (opt.url) {
                net.ajax({
                    url: url,
                    success: callback
                });
            }
        } else {
            modalCard.set(opt).open();
        }
        function callback(data){
            if (tm !== _modal_tm) {
                return;
            }
            if (opt.jsonUrl) {
                data = data.html;
            }
            opt.content = data;
            actions.hideLoading();
            modalCard.set(opt).open();
        }
    },

    closeModal: function(){
        _modal_tm = 0;
        modalCard.cancel();
        return modalCard.event.promise('close');
    },

    openImage: function(src){
        actions.openLink(src, {
            target: '_blank'
        });
    },

    notify: function(content, opt) {
        return growl(_.mix({
            content: content
        }, opt)).open();
    },

    showLoading: function(text){
        if (!this.loadingTips) {
            this.loadingTips = growl({
                expires: -1,
                keepalive: true,
                corner: 'center'
            });
        }
        this.loadingTips.set({
            content: text || '加载中...'
        }).open();
        this._loadingStart = +new Date();
    },

    hideLoading: function(opt){
        opt = _.mix({ duration: 800 }, opt);
        var d = +new Date() - this._loadingStart;
        if (d < opt.duration) {
            setTimeout(function(){
                actions.hideLoading(opt);
            }, opt.duration - d);
        } else {
            if (this.loadingTips) {
                this.loadingTips.close();
            }
        }
    },

    updatePicker: function(pickerObj, new_val){
        if (Array.isArray(new_val)) {
            var old_val = pickerObj.val();
            _.each(old_val, function(v){
                if (!this[v]) {
                    pickerObj.unselect(v);
                }
            }, _.index(new_val));
            _.each(new_val, function(v){
                if (!this[v]) {
                    pickerObj.select(v);
                }
            }, _.index(old_val));
        } else {
            pickerObj.select(new_val);
        }
    },

    openLink: function(href, opt){
        opt = opt || {};
        if (typeof href !== 'string') {
            var node = href;
            href = node.href;
            opt.target = opt.target || node.target;
        }
        if (opt.target && opt.target !== '_self') {
            window.open(href, opt.target);
        } else {
            location.href = href;
        }
    }

};

var exports = {

    init: function(opt){
        opt = opt || {};
        var wrapper = $(opt.appWrapper);
        actionView.forceOptions.parent = wrapper;
        growl.defaultOptions.parent = wrapper;
        modalCard.set({
            oldStylePage: opt.oldStyle,
            parent: wrapper
        });
        var tapGesture = momoTap(doc);
        set_alias_events(tapGesture.event);
        var prevent_click_events = {};
        Object.keys(tap_events).forEach(function(selector){
            this[selector] = nothing;
        }, prevent_click_events);
        this.delegate.on('tap', tap_events)
            .on('click', prevent_click_events);
        this.brightDelegate.on('change', {
            '.ck-ranger': function(e){
                ranger(this).val(e.target.value);
                return true;
            }
        }).on('touchstart', {
            '.ck-ranger': function(e){
                ranger(this).val(e.target.value);
                ranger(this).changeStart();
                return true;
            }
        }).on('touchend', {
            '.ck-ranger': function(){
                ranger(this).changeEnd();
                return true;
            }
        });
    },

    delegate: soviet(doc, _soviet_opt),
    brightDelegate: new BrightSoviet(doc, _soviet_opt),
    darkDelegate: new DarkSoviet(doc, _soviet_opt),

    action: actions,
    component: components

};


function handle_control(){
    var controller = control(this),
        cfg = controller.data();
    if (cfg.disableUrl || cfg.disableJsonUrl) {
        controller.toggle();
    } else if (!controller.isEnabled) {
        controller.enable();
    }
} 

function toggle_control(){
    control(this).toggle();
} 

function tap_ck_post(){
    if (!$(this).hasClass('ck-post-button')) {
        return tap_ck_post.call(this.parentNode);
    }
    handle_control.call(this);
}

function tap_ck_switch(){
    if (!$(this).hasClass('ck-switch')) {
        return tap_ck_switch.call(this.parentNode);
    }
    toggle_control.call(this);
}

function show_actions(me){
    var opt = _.mix({
        confirmText: '确认',
        cancelText: '取消',
        multiselect: false
    }, me.data());
    opt.options = $(opt.options || '.ck-option', me);
    return actionView(me, opt).open();
}

function set_alias_events(events) {
    for (var ev in events) {
        $.Event.aliases[ev] = _soviet_aliases[ev] = 'ck_' + events[ev];
    }
}

function nothing(){}

return exports;

});

