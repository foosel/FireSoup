var FireSoup = {
	open: function() {
		window.openDialog(
			"chrome://firesoup/content/dialog.xul",
			"firesoupDialog",
			"chrome,dialog,centerscreen,resizable=no",
			"quote", ""
		);
	},
	
	close: function() {
		window.close();
	},
	
	init: function() {
		var mode = null;
		try {
			mode = window.arguments[0];
		} catch (e) {};
		//var mode = "quote";
		
		var testlabel = document.getElementById("testlabel");
		testlabel.value = "Session ID: " + Soup.sessionId();
		
		var testeditor = document.getElementById("testeditor");
		testeditor.contentDocument.designMode = 'on';
		
		var tabbox = document.getElementById("modeTabs");
		switch(mode) {
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
		}
	},
	
	_editorMode: "html",
	toggleEditor: function() {
		var testeditor = document.getElementById("testeditor");
		
		if (this._editorMode == "html") {
			testeditor.makeEditable("text", false);
		} else {
			testeditor.makeEditable("html", false);
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

