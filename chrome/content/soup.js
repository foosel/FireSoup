var Soup = {

	/** Soup.io cookie domain */
	//cookieDomain: "http://www.soup.io",
	cookieDomain: "http://try.soup.io",
	
	/** Soup.io session cookie name */
	cookieName: "soup_session_id",
	
	/** Soup.io post url */
	postUrl: "http://www.soup.io/bookmarklet/save",
	
	_sessionId: null,
	sessionId: function() {
		if (this._sessionId == null) {
			// get cookie string from cookie service for the cookie domain
			var ioSvc = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
			var uri = ioSvc.newURI(this.cookieDomain, null, null);
			var cookieSvc = Components.classes["@mozilla.org/cookieService;1"].getService(Components.interfaces.nsICookieService);
			var cookie = cookieSvc.getCookieString(uri, null);
			
			// determine position in cookiestring
	        var prefix = this.cookieName + "=";
	        var begin = cookie.indexOf("; " + prefix);
	        if (begin == -1) {
	            begin = cookie.indexOf(prefix);
	            if (begin != 0) return null;
	        } else {
	            begin += 2;
	        }
	        var end = cookie.indexOf(";", begin);
	        if (end == -1) {
	            end = cookie.length;
	        }
	        
	        // slice out cookie value
	        this._sessionId = unescape(cookie.substring(begin + prefix.length, end));
		}
        return this._sessionId;
	},

	post: function(post, blog_id) {
		var data = post + "&post%5Bblog_id%5D=" + blog_id;
		
		var req = new XMLHttpRequest();
		req.open("POST", this.postUrl, false);
		req.setRequestHeader("Referer", "http://www.soup.io/bookmarklet/");
		req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		req.send(data);
		
		alert("Status: " + req.status + ", Body: " + req.responseText);
	},
	
	createQuote: function(title, text, source) {
		var post = "post%5Btype%5D=quote&post%5Bsource%5D="+encodeURIComponent(source)+"&post%5Bbody%5D="+encodeURIComponent(text);
		if (title) post += "&post%5Btitle%5D="+encodeURIComponent("<a href=\""+source+"\">"+title+"</a>");
		return post;
	}
	
};
