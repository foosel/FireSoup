var FireSoup = {
	open: function() {
		var browser = window.getBrowser();
		var contentDoc = browser.contentDocument;
		var contentWin = browser.contentWindow;
		
		// get title
		var title = contentDoc.title;
	
		// get source
		var source = browser.currentURI.spec;
	
		// get selection
	    var selection = '';
	    var winSel = contentWin.getSelection();
	    if (!winSel || winSel == "") {
	    	for (var i = 0; i < contentWin.frames.length; i++) {
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
	    for (var i = 0; i < contentDoc.images.length; i++) {
	    	var img = contentDoc.images[i];
	    	if (img.offsetWidth && img.offsetHeight && img.offsetWidth*img.offsetHeight > 70*70) {
	    		var pushable = {
	    			name: "img_" + i,
	    			url: img.src,
	    			width: img.offsetWidth,
	    			height: img.offsetHeight
	    		};
	    		images.push(pushable);
	    	}
	    }
	    
	    // prepare post and open dialog
		var post = {
				type: "quote",
				source: source,
				title: title,
				selection: selection,
				images: images
		};
		
		window.openDialog(
			"chrome://firesoup/content/dialog.xul",
			"firesoupDialog",
			"chrome,dialog,centerscreen,resizable=no",
			post
		);
	},
	
	close: function() {
		window.close();
	},
	
	init: function() {
		try {
			var post = window.arguments[0];
		} catch (e) {
			// DEBUGGING
			post = {
					type: "image",
					source: "http://www.mozilla.org/",
					title: "Mozilla - Home of the Mozilla Project",
					selection: "",
					images: [
				               {
				            	   name: "img_0",
				            	   url: "http://www.mozilla.org/images/feature-logos2.png",
				            	   width: 102,
				            	   height: 96
				               },
				               {
				            	   name: "img_1",
				            	   url: "http://www.mozilla.org/images/front-moz-store.png",
				            	   width: 150,
				            	   height: 150
				               }
				            ]
			};
		}
		
		var testlabel = document.getElementById("testlabel");
		testlabel.value = "Session ID: " + Soup.sessionId();
		
		var tabbox = document.getElementById("modeTabs");
		switch(post.type) {
		case "text":
		default:
			tabbox.selectedIndex = 0;
			break;
		case "link":
			tabbox.selectedIndex = 1;
			break;
		case "quote":
			tabbox.selectedIndex = 2;
			break;
		case "image":
			tabbox.selectedIndex = 3;
			break;
		}
		
		// set titles
		var titleElements = ["text.title", "link.caption", "quote.title"];
		for (var i = 0; i < titleElements.length; i++) {
			var e = document.getElementById(titleElements[i]);
			if (e) e.value = post.title; 
		}
		
		// set URLs
		var urlElements = ["link.url", "quote.source"];
		for (var i = 0; i < urlElements.length; i++) {
			var e = document.getElementById(urlElements[i]);
			if (e) e.value = post.source; 
		}
		
		// set texts
		var textElements = ["text.text", "link.description", "quote.text"];
		for (var i = 0; i < textElements.length; i++) {
			var e = document.getElementById(textElements[i]);
			if (e) e.value = post.selection; 
		}
		
		// set images
		var imageRows = document.getElementById("image.imagerows");
		var curRow = null;
		var curImg = null;
		var image = null;
		if (post.images) {
			for (var i = 0; i < post.images.length; i++) {
				if (i % 4 == 0) {
					curRow = document.createElement("row");
					imageRows.appendChild(curRow);
				}
				image = post.images[i];
				curImg = document.createElement("image");
				curImg.id = "image." + image.name;
				curImg.src = image.url;
				curImg.width = 70;
				curImg.height = 70;
				curImg.oncommand = "alert('this.id')";
				curRow.appendChild(curImg);
			}
			
		}
	},
	
	post: function() {
		var tabbox = document.getElementById("modeTabs");
		var selectedIdx = tabbox.selectedIndex;
		
		var post = null;
		switch (selectedIdx) {
			case 2:
				var quote_title = document.getElementById("quote.title").value;
				var quote_text = document.getElementById("quote.text").value;
				var quote_source = document.getElementById("quote.source").value;
				post = Soup.createQuote(quote_title, quote_text, quote_source);
				break;
		}
		
		// TEST CODE
		var blog_id = "161640";
		Soup.post(post, blog_id);
		// /TEST CODE
		
		this.close();
	}
};

