import RestModel from 'discourse/models/rest';

export default RestModel.extend({
  loaded: false,

  _initialize: function() {
    this.setProperties({ itemsLoaded: 0, content: [] });
  }.on("init"),

  filterParam: function() {
    const filter = this.get('filter');
    if (filter === Discourse.UserAction.TYPES.replies) {
      return [Discourse.UserAction.TYPES.replies,
              Discourse.UserAction.TYPES.quotes].join(",");
    }

    if(!filter) {
      return [Discourse.UserAction.TYPES.topics,
              Discourse.UserAction.TYPES.posts].join(",");
    }

    return filter;
  }.property('filter'),

  baseUrl: Discourse.computed.url('itemsLoaded', 'user.username_lower', '/user_actions.json?offset=%@&username=%@'),

  filterBy(filter) {
    this.setProperties({ filter, itemsLoaded: 0, content: [], lastLoadedUrl: null });
    return this.findItems();
  },

  remove(userAction) {
    // 1) remove the user action from the child groups
    this.get("content").forEach(function (ua) {
      ["likes", "stars", "edits", "bookmarks"].forEach(function (group) {
        const items = ua.get("childGroups." + group + ".items");
        if (items) {
          items.removeObject(userAction);
        }
      });
    });

    // 2) remove the parents that have no children
    const content = this.get("content").filter(function (ua) {
      return ["likes", "stars", "edits", "bookmarks"].any(function (group) {
        return ua.get("childGroups." + group + ".items.length") > 0;
      });
    });

    this.setProperties({ content, itemsLoaded: content.length });
  },

  findItems() {
    const self = this;

    let url = this.get('baseUrl');
    if (this.get('filterParam')) {
      url += "&filter=" + this.get('filterParam');
    }

    // Don't load the same stream twice. We're probably at the end.
    const lastLoadedUrl = this.get('lastLoadedUrl');
    if (lastLoadedUrl === url) { return Ember.RSVP.resolve(); }

    if (this.get('loading')) { return Ember.RSVP.resolve(); }
    this.set('loading', true);
    return Discourse.ajax(url, {cache: 'false'}).then( function(result) {
      if (result && result.user_actions) {
        const copy = Em.A();
        result.user_actions.forEach(function(action) {
          action.title = Discourse.Emoji.unescape(action.title);
          copy.pushObject(Discourse.UserAction.create(action));
        });

        self.get('content').pushObjects(Discourse.UserAction.collapseStream(copy));
        self.setProperties({
          loaded: true,
          itemsLoaded: self.get('itemsLoaded') + result.user_actions.length
        });
      }
    }).finally(function() {
      self.set('loading', false);
      self.set('lastLoadedUrl', url);
    });
  }

});
