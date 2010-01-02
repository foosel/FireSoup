/*
 * FireSoup
 *
 * Copyright (c) 2010 Gina Haeussge
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA
 */

/**
 * Encapsulates all functionality needed by FireSoup.
 */
var FireSoup = {

	/** The version of the supported Soup bookmarklet. */
	version: 5,

	/** The Console Service instance. */
	consoleService: null,

	/** The Preference Manager instance. */
	prefManager: null,

	/** The URL of the bookmarklet. */
	bookmarkletUrl: "http://www.soup.io/bookmarklet/",

	/** The URL to trigger a closing of the bookmarklet window. */
	bookmarkletCloseTriggerUrl: "http://www.soup.io/bookmarklet/save",

	/**
	 * Retrieves the information necessary for the Soup bookmarklet to work from the currently opened
	 * page and then opens the new browser window to be used for the bookmarklet.
	 */
	open: function() {
		// prepare access to page
		var browser = window.getBrowser();
		var contentDoc = browser.contentDocument;
		var contentWin = browser.contentWindow;
		var i = 0, j = 0;

		// get title
		var title = contentDoc.title;

		// get source
		var source = browser.currentURI.spec;

		// get selection
		var selection = '';
		var winSel = contentWin.getSelection();
		if (!winSel || winSel == "") {
			for (i = 0; i < contentWin.frames.length; i++) {
				winSel = contentWin.frames[i].window.getSelection();
				if (winSel && winSel != "") {
					break;
				}
			}
		}

		if (winSel && winSel != "") {
			var range = winSel.getRangeAt(0);
			if (range) {
				var div = contentDoc.createElement("div");
				div.appendChild(range.cloneContents());
				selection = div.innerHTML;
			}
		}

		// get images
		var images = [];
		var imgIndex = 0;
		var frames = this.collectFrames(contentWin);
		var docs = [];

		FireSoup.log("Found " + frames.length + " frames");
		for (i = 0; i < frames.length; i++) {
			docs.push(frames[i].document);
		}
		for (i = 0; i < docs.length; i++) {
			var doc = docs[i];
			for (j = 0; j < doc.images.length; j++) {
				var img = doc.images[j];
				if (img.offsetWidth && img.offsetHeight && img.offsetWidth*img.offsetHeight > 70*70) {
					var pushable = {
						name: "img_" + imgIndex,
						url: img.src,
						width: img.offsetWidth,
						height: img.offsetHeight
					};
					images.push(pushable);
					imgIndex++;
				}
			}
		}

		// get trackback url
		var trackback_url = contentDoc.body.innerHTML.match('trackback:ping="(.*)"');

		// prepare post data
		var post = {
				source: source,
				title: title,
				selection: selection,
				images: images,
				trackback: trackback_url
		};
		var postData = this.preparePostData(post);

		// open popup and display loading message
		window.openDialog(
				"chrome://firesoup/content/browser.xul",
				"_blank",
				"toolbar=0,resizable=1,scrollbars=yes,status=1,width=450,height=400",
				postData
		);
	},

	/**
	 * Loads the bookmarklet into the bookmarklet browser.
	 */
	init: function() {
		// load bookmarklet
		var postData = window.arguments[0];
		var bookmarkletBrowser = window.document.getElementById("content");
		bookmarkletBrowser.addEventListener("DOMContentLoaded", this.onDOMContentLoaded, true);
		bookmarkletBrowser.loadURIWithFlags(FireSoup.bookmarkletUrl, null, null, null, postData);
	},

	/**
	 * Handler for DOMContentLoaded event on the bookmarklet browser instance. Closes the window
	 * if the url loaded equals the bookmarklet close trigger url. The content of the loaded
	 * document then would be a simple Javascript calling "self.close()", this doesn't work here though
	 * as the window wasn't opened using window.open and thus we have to use that rather unconventional
	 * approach to closing the window.
	 *
	 * @param event The DOMContentLoaded event.
	 */
	onDOMContentLoaded: function(event) {
		url = window.document.getElementById("content").contentDocument.location.href;
		FireSoup.log("DOMContentLoaded event for " + url);
		if (FireSoup.bookmarkletCloseTriggerUrl == url) {
			FireSoup.log("Bookmarklet close trigger activated, closing the window");
			window.close();
		}
	},

	/**
	 * Encapsulates the page information necessary for the soup bookmarklet (source, selection, title, optional images
	 * and optional trackback url) into a post payload object suitable for posting via a browser instance.
	 *
	 * @param  post The page information to send to the soup bookmarklet.
	 * @return A MIME stream object containing the post payload.
	 */
	preparePostData: function(post) {
		const CC = Components.classes;
		const CI = Components.interfaces;

		var dataString = "";
		dataString += "u=" + encodeURIComponent(post.source);
		dataString += "&s=" + encodeURIComponent(post.selection);
		dataString += "&t=" + encodeURIComponent(post.title);
		dataString += "&v=" + this.version;
		if (post.images.length > 0) {
			for (var i = 0; i < post.images.length; i++) {
				dataString += "&" + post.images[i].name + "=" + encodeURIComponent(post.images[i].url) + "&" + post.images[i].name + "_w=" + post.images[i].width + "&" + post.images[i].name + "_h=" + post.images[i].height;
			}
		}
		if (post.trackback) {
			dataString += "&tb=" + encodeURIComponent(post.trackback);
		}
		this.log("Prepared data for bookmarklet: " + dataString);

		// POST method requests must wrap the encoded text in a MIME
		// stream
		var stringStream = CC["@mozilla.org/io/string-input-stream;1"].createInstance(CI.nsIStringInputStream);
		if ("data" in stringStream) {
			// Gecko 1.9 or newer
			stringStream.data = dataString;
		} else {
			// 1.8 or older
			stringStream.setData(dataString, dataString.length);
		}

		var postData = CC["@mozilla.org/network/mime-input-stream;1"].createInstance(CI.nsIMIMEInputStream);
		postData.addHeader("Content-Type", "application/x-www-form-urlencoded");
		postData.addContentLength = true;
		postData.setData(stringStream);
		return postData;
	},

	collectFrames: function(win) {
		var frames = [];
		frames.push(win);
		for (var i = 0; i < win.frames.length; i++) {
			frames = frames.concat(this.collectFrames(win.frames[i].window));
		}
		return frames;
	},

	/**
	 * Logs the given text to the error console if debuglogging is enabled.
	 *
	 * @param message The message to log.
	 */
	log: function(message) {
		if (this.getPrefManager().getBoolPref("extensions.firesoup.debuglogging")) {
			this.getConsoleService().logStringMessage("[FireSoup] " + message);
		}
	},

	/**
	 * @return The Preference Manager instance to use for looking up preferences.
	 */
	getPrefManager: function() {
		if (this.prefManager == null) {
			this.prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		}
		return this.prefManager;
	},

	/**
	 * @return The Console Service instance to use for logging to the error console.
	 */
	getConsoleService: function() {
		if (this.consoleService == null) {
			this.consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		}
		return this.consoleService;
	}

};
