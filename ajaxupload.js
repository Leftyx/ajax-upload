/**
 * AJAX Upload ( http://valums.com/ajax-upload/ ) 
 * Copyright (c) Andris Valums
 * Licensed under the MIT license ( http://valums.com/mit-license/ )
 * Thanks to Gary Haran, David Mark, Corey Burns and others for contributions
 */
;(function(){
    // for jslint
    /*global window*/
            
    /**
     * Attaches event to a dom element.
     * @param {DOM element} el
     * @param type event name
     * @param fn callback This refers to the passed element
     */
    function addEvent(el, type, fn){
        if (el.addEventListener) {
            el.addEventListener(type, fn, false);
        } else if (el.attachEvent) {
            el.attachEvent('on' + type, function(){
                fn.call(el);
	        });
	    } else {
            throw new Error('not supported');
        }
    }   
    
    /**
     * Attaches resize event to a window, limiting
     * number of event fired. Fires only when encounteres
     * delay of 100 after series of events.
     * 
     * Some browsers fire event multiple times when resizing
     * http://www.quirksmode.org/dom/events/resize.html
     * 
     * @param fn callback This refers to the passed element
     */
    function addResizeEvent(fn){
        var timeout;       
	    addEvent(window, 'resize', function(){
            if (timeout){
                clearTimeout(timeout);
            }
            timeout = setTimeout(fn, 100);                        
        });
    }    
    
    // Needs more testing, will be rewriten for next version        
    // getOffset function copied from jQuery lib (http://jquery.com/)
    if (document.documentElement.getBoundingClientRect){
        // Get Offset using getBoundingClientRect
        // http://ejohn.org/blog/getboundingclientrect-is-awesome/
        var getOffset = function(el){
            var box = el.getBoundingClientRect();
            var doc = el.ownerDocument;
            var body = doc.body;
            var docElem = doc.documentElement; // for ie 
            var clientTop = docElem.clientTop || body.clientTop || 0;
            var clientLeft = docElem.clientLeft || body.clientLeft || 0;
             
            // In Internet Explorer 7 getBoundingClientRect property is treated as physical,
            // while others are logical. Make all logical, like in IE8.	
            var zoom = 1;            
            if (body.getBoundingClientRect) {
                var bound = body.getBoundingClientRect();
                zoom = (bound.right - bound.left) / body.clientWidth;
            }
            
            if (zoom > 1) {
                clientTop = 0;
                clientLeft = 0;
            }
            
            var top = box.top / zoom + (window.pageYOffset || docElem && docElem.scrollTop / zoom || body.scrollTop / zoom) - clientTop, left = box.left / zoom + (window.pageXOffset || docElem && docElem.scrollLeft / zoom || body.scrollLeft / zoom) - clientLeft;
            
            return {
                top: top,
                left: left
            };
        };        
    } else {
        // Get offset adding all offsets 
        var getOffset = function(el){
            var top = 0, left = 0;
            do {
                top += el.offsetTop || 0;
                left += el.offsetLeft || 0;
                el = el.offsetParent;
            } while (el);
            
            return {
                left: left,
                top: top
            };
        };
    }
    
    /**
     * Returns left, top, right and bottom properties describing the border-box,
     * in pixels, with the top-left relative to the body
     * @param {DOM element} el
     * @return {Object} Contains left, top, right,bottom
     */
    function getBox(el){
        var left, right, top, bottom;
        var offset = getOffset(el);
        left = offset.left;
        top = offset.top;
        
        right = left + el.offsetWidth;
        bottom = top + el.offsetHeight;
        
        return {
            left: left,
            right: right,
            top: top,
            bottom: bottom
        };
    }
    
    /**
     * Helper that takes object literal
     * and add all properties to element.style
     * @param {DOM element} el
     * @param {Object} styles
     */
    function addStyles(el, styles){
        for (var i in styles) {
            el.style[i] = styles[i];
        }
    }
        
    /**
     * Function places an absolutely positioned
     * element on top of the specified element
     * copying position and dimentions.
     * @param {DOM element} from
     * @param {DOM element} to
     */    
    function copyLayout(from, to){
	    var box = getBox(from);
        
        addStyles(to, {
	        position: 'absolute',                    
	        left : box.left + 'px',
	        top : box.top + 'px',
	        width : from.offsetWidth + 'px',
	        height : from.offsetHeight + 'px'
	    });        
    }

    /**
    * Creates and returns element from html chunk
    * Uses innerHTML to create an element
    */
    var toElement = (function(){
        var div = document.createElement('div');
        return function(html){
            div.innerHTML = html;
            var el = div.firstChild;
            return div.removeChild(el);
        };
    })();
            
    /**
     * Function generates unique id
     * @return unique id 
     */
    var getUID = (function(){
        var id = 0;
        return function(){
            return 'ValumsAjaxUpload' + id++;
        };
    })();        
 
    /**
     * Get file name from path
     * @param {String} file path to file
     * @return filename
     */  
    function fileFromPath(file){
        return file.replace(/.*(\/|\\)/, "");
    }
    
    /**
     * Get file extension lowercase
     * @param {String} file name
     * @return file extenstion
     */    
    function getExt(file){
        return (-1 !== file.indexOf('.')) ? file.replace(/.*[.]/, '') : '';
    }

    function hasClass(el, name){
        if (! el.hasAttribute('className')){
            return false;
        }

        var re = new RegExp('\\b' + name + '\\b'),
            current = el.getAttribute('className');
        
        return re.test(current);
    }    
    function addClass(el, name){
        if ( ! hasClass(el, name)){            
            if (el.hasAttribute('className')){
                var current = el.getAttribute('className');
                el.setAttribute('className', current + ' ' + name);
            } else {
                el.setAttribute('className', name);
            }
        }
    }    
    function removeClass(el, name){
        if (el.hasAttribute('className')){
            var re = new RegExp('\\b' + name + '\\b'),
                current = el.getAttribute('className');
                
            el.setAttribute('className', current.replace(re, ''));       
        }        
    }

    /**
     * Easy styling and uploading
     * @constructor
     * @param button An element you want convert to 
     * upload button. Tested dimentions up to 500x500px
     * @param {Object} options See defaults below.
     */
    window.AjaxUpload = function(button, options){
        this._settings = {
            // Location of the server-side upload script
            action: 'upload.php',
            // File upload name
            name: 'userfile',
            // Additional data to send
            data: {},
            // Submit file as soon as it's selected
            autoSubmit: true,
            // The type of data that you're expecting back from the server.
            // html and xml are detected automatically.
            // Only useful when you are using json data as a response.
            // Set to "json" in that case. 
            responseType: false,
            // Class applied to button when mouse is hovered
            hoverClass: 'hover',
            // When user selects a file, useful with autoSubmit disabled
            // You can return false to cancel upload			
            onChange: function(file, extension){
            },
            // Callback to fire before file is uploaded
            // You can return false to cancel upload
            onSubmit: function(file, extension){
            },
            // Fired when file upload is completed
            // WARNING! DO NOT USE "FALSE" STRING AS A RESPONSE!
            onComplete: function(file, response){
            }
        };
                        
        // Merge the users options with our defaults
        for (var i in options) {
            this._settings[i] = options[i];
        }
                
        // button isn't necessary a dom element
        if (button.jquery) {
            // jQuery object was passed
            button = button[0];
        } else if (typeof button == "string" && /^#.*/.test(button)) {
            // If jQuery user passes #elementId don't break it					
            button = button.slice(1);
	    } else if (typeof element == "string") {
	        button = document.getElementById(button);
	    }
        
        // DOM element
        this._button = button;        
        // DOM element                 
        this._input = null;
        // If disabled clicking on button won't do anything
        this._disabled = false;        
        
        this._rerouteClicks();
    };
    
    // assigning methods to our class
    AjaxUpload.prototype = {
        setData: function(data){
            this._settings.data = data;
        },
        disable: function(){
            this._disabled = true;
            if (this._input){
                this._input.parentNode.style.display = 'none';
            }
        },
        enable: function(){
            this._disabled = false;
            if (this._input){
                this._input.parentNode.style.display = 'block';
            }                        
        },
        /**
         * Creates invisible file input 
         * that will hover above the button
         * <div><input type='file' /></div>
         */
        _createInput: function(){ 
            var self = this;
                        
            var input = document.createElement("input");
            input.setAttribute('type', 'file');
            input.setAttribute('name', this._settings.name);
            
            addStyles(input, {
                'position' : 'absolute',
                // in Opera only 'browse' button
                // is clickable and is located at
                // the right side of the input
                'right' : 0,
                'margin' : 0,
                'padding' : 0,
                'fontSize' : '480px',                
                'cursor' : 'pointer'
            });            
            
            var div = document.createElement("div");                        
            addStyles(div, {
                'display' : 'block',
                'position' : 'absolute',
                'overflow' : 'hidden',
                'margin' : 0,
                'padding' : 0,                
                'opacity' : 0,
                // Make sure browse button is in the right side
                // in Internet Explorer
                'direction' : 'ltr',
                //Max zIndex supported by Opera 9.0-9.2
                'zIndex': 2147483583
            });
            
            // Make sure that element opacity exists.
            // Otherwise use IE filter            
            if ( div.style.opacity !== "0") {
                if (typeof(div.filters) == 'undefined'){
                    throw new Error('Opacity not supported by the browser');
                }
                div.style.filter = "alpha(opacity=0)";
            }            
            
            div.appendChild(input);
            document.body.appendChild(div);                       
           
            addEvent(input, 'change', function(){
                // Get filename from input, required
                // as some browsers have path instead of it                
                var file = fileFromPath(this.value);
                
                var res = self._settings.onChange.call(self, file, getExt(file));                                
                if (res == false){
                    // prevent submit if user returns false
                    return;
                }
                
                // Submit form when value is changed
                if (self._settings.autoSubmit) {
                    self.submit();
                }
            });            

            addEvent(input, 'mouseover', function(){
                addClass(self._button, self._settings.hoverClass);
            });
            
            addEvent(input, 'mouseout', function(){
                removeClass(self._button, self._settings.hoverClass);
            });   
                        
            this._input = input;
        },
        /**
         * Function makes sure that when user clicks upload button,
         * the this._input is clicked instead
         */
        _rerouteClicks: function(){
            var self = this;
            
            // IE will later display 'access denied' error
            // if you use using self._input.click()
            // other browsers just ignore click()

            addEvent(self._button, 'mouseover', function(){
                if (self._disabled){
                    return;
                }
                
                if ( ! self._input){
	                self._createInput();
                }
                
                var div = self._input.parentNode;
                div.style.opacity = '0.5';                
                
                copyLayout(self._button, div);
                                
            });
            
            /**
             * When the window is resized the elements 
             * can be misaligned if button position depends
             * on window size
             */
            addResizeEvent(function(){
                if (self._input){
                    copyLayout(self._button, self._input.parentNode);
                }
            });            
                                         
        },
        /**
         * Creates iframe with unique name
         * @return {DOM element} iframe
         */
        _createIframe: function(){
            // We can't use getTime, because it sometimes return
            // same value in safari :(
            var id = getUID();            
             
            // We can't use following code as the name attribute
            // won't be properly registered in IE6, and new window
            // on form submit will open
            // var iframe = document.createElement('iframe');
            // iframe.setAttribute('name', id);                        
 
            var iframe = toElement('<iframe src="javascript:false;" name="' + id + '" />');
            // src="javascript:false; was added
            // because it possibly removes ie6 prompt 
            // "This page contains both secure and nonsecure items"
            // Anyway, it doesn't do any harm.            
            iframe.setAttribute('id', id);
            
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            
            return iframe;
        },
        /**
         * Creates form, that will be submitted to iframe
         * @param {DOM element} iframe Where to submit
         * @return {DOM element} form
         */
        _createForm: function(iframe){
            var settings = this._settings;
                        
            // We can't use the following code in IE6
            // var form = document.createElement('form');
            // form.setAttribute('method', 'post');
            // form.setAttribute('enctype', 'multipart/form-data');
            // Because in this case file won't be attached to request                    
            var form = toElement('<form method="post" enctype="multipart/form-data"></form>');
                        
            form.setAttribute('action', settings.action);
            form.setAttribute('target', iframe.name);                                   
            form.style.display = 'none';
            document.body.appendChild(form);
            
            // Create hidden input element for each data key
            for (var prop in settings.data) {
                var el = document.createElement("input");
                el.setAttribute('type', 'hidden');
                el.setAttribute('name', prop);
                el.setAttribute('value', settings.data[prop]);
                form.appendChild(el);
            }
            return form;
        },        
        /**
         * Upload file without refreshing the page
         */
        submit: function(){
            var self = this, settings = this._settings;
            
            if (this._input.value === '') {
                // there is no file
                return;
            }
            
            // get filename from input
            var file = fileFromPath(this._input.value);
            
            // execute user event
            if (false != settings.onSubmit.call(this, file, getExt(file))) {
                // Create new iframe for this submission
                var iframe = this._createIframe();
                
                // Do not submit if user function returns false										
                var form = this._createForm(iframe);
                form.appendChild(this._input);
                
                form.submit();                
                document.body.removeChild(form);                
                form = null;
                this._input = null;
                
                // create new input
                this._createInput();
                
                var toDeleteFlag = false;
                
                addEvent(iframe, 'load', function(){                
                    if (// For Safari 
                        iframe.src == "javascript:'%3Chtml%3E%3C/html%3E';" ||
                        // For FF, IE
                        iframe.src == "javascript:'<html></html>';"){                                                
                            // First time around, do not delete.
                            if (toDeleteFlag) {
                                // Fix busy state in FF3
                                setTimeout(function(){
                                    document.body.removeChild(iframe);
                                }, 0);
                            }
                            return;
                    }
                    
                    var doc = iframe.contentDocument ? iframe.contentDocument : frames[iframe.id].document;
                    
                    // fixing Opera 9.26
                    if (doc.readyState && doc.readyState != 'complete') {
                        // Opera fires load event multiple times
                        // Even when the DOM is not ready yet
                        // this fix should not affect other browsers
                        return;
                    }
                    
                    // fixing Opera 9.64
                    if (doc.body && doc.body.innerHTML == "false") {
                        // In Opera 9.64 event was fired second time
                        // when body.innerHTML changed from false 
                        // to server response approx. after 1 sec
                        return;
                    }
                    
                    var response;
                    
                    if (doc.XMLDocument) {
                        // response is a xml document IE property
                        response = doc.XMLDocument;
                    } else if (doc.body) {
                        // response is html document or plain text
                        response = doc.body.innerHTML;
                        if (settings.responseType && settings.responseType.toLowerCase() == 'json') {
                            // If the document was sent as 'application/javascript' or
                            // 'text/javascript', then the browser wraps the text in a <pre>
                            // tag and performs html encoding on the contents.  In this case,
                            // we need to pull the original text content from the text node's
                            // nodeValue property to retrieve the unmangled content.
                            // Note that IE6 only understands text/html
                            if (doc.body.firstChild && doc.body.firstChild.nodeName.toUpperCase() == 'PRE') {
                                response = doc.body.firstChild.firstChild.nodeValue;
                            }
                            if (response) {
                                response = eval("(" + response + ")");
                            }
                            else {
                                response = {};
                            }
                        }
                    } else {
                        // response is a xml document
                        var response = doc;
                    }
                    
                    settings.onComplete.call(self, file, response);
                    
                    // Reload blank page, so that reloading main page
                    // does not re-submit the post. Also, remember to
                    // delete the frame
                    toDeleteFlag = true;
                    
                    // Fix IE mixed content issue
                    iframe.src = "javascript:'<html></html>';";
                });
                
            } else {
                // clear input to allow user to select same file 
                // this._input.value = ''; Doesn't work in IE6
                
                document.body.removeChild(this._input);
                this._input = null;                
                // create new input
                this._createInput();
            }
        }
    };
})();