const baseUrl = 'http://synopsisserver.dicta.org.il/synopsis'
const urlExtend = '/api/synopsis'
const urlUpload = '/uploadfile'

var pre_process = function(utf8_string) {
	unicode_string = escape(utf8_string).replace(/%u/g, '\\u').replace(/%20/g, ' ');
	unicode_string = unicode_string.replace(/D/g, 'd');
	unicode_string = unicode_string.replace(/%2C/g, ',');
	unicode_string = unicode_string.replace(/%21/g, '!');
	request_object = '{"genre": "modern", "data": "'+unicode_string+'"}';
	return request_object
}

var post_process = function(response_array) {
	display_string = "";
	for (i=0; i<response_array.length; i++) {
		if (response_array[i].sep) { display_string += response_array[i].word; }
		else { display_string += response_array[i].options[0]; }
	}
	console.log(display_string)
	return display_string;
}

var app = new Vue({
  el: '#app',
  data: {
		// for header/main/footer:
		screen: 'home',
		showTools: false,
		// for home screen:
		dragAndDropCapable: false,
		filesReceived: [],
		// for requesting screen:
		loading: false,
		timedOut: false,
		failed: false,
		// for requesting and results screen:
		top_items_alignment: [],
		// for results screen:
		rowsPerPage: 200,
		currentPage: 1,
		showAll: true,
		// from original test program:
		submission1: '',
		submission2: '',
		submissionData: {},
		sessionID: null,
		nextUpload: null
	},
	computed: {
		thisPageRows: function () {
			let start = ((this.currentPage - 1) * this.rowsPerPage) + 1
			return this.top_items_alignment.slice(start, start + this.rowsPerPage)
		},
		thisPageRowNumbers: function () {
			let start = ((this.currentPage - 1) * this.rowsPerPage) + 1
			let nums = []
			for (var i = start; i < (start + this.rowsPerPage); i++) {
				nums.push(i)
			}
			return nums
		},
		columnHeads: function () {
			// if (this.top_items_alignment.length > 0) { return this.top_items_alignment[0] } else { return [] }
			names = []
			this.filesReceived.forEach(oneFile => {
				names.push(oneFile.name)
			})
			return names
		},
		pageNumsToShow: function () {
			let nums = []
			for (var i = this.currentPage - 2; i < ((this.top_items_alignment.length / this.rowsPerPage) + 2); i++) {
				if ((i > 0) && (i < (this.currentPage + 3)) && ((((i - 1) * this.rowsPerPage) + 1) <= (this.top_items_alignment.length - 1))) {
					nums.push(i)
				}
			}
			return nums
		},
		downloadHref: function () {
			return this.excelURL
		}
	},
	watch: {
		filesReceived: function () {
			if (this.filesReceived.length < 2) {
				$('.btn_start').popover('show') 
				$('.btn_start').popover('hide') 
			} else { $('.btn_start').popover('dispose') }
		},
		screen: function () {
			if (this.screen === 'home') {
				setTimeout(this.dragAndDropInit, 250)
			}
		}
	},
  methods: {
		// for header/main/footer:
		toDicta: function () {
			window.location = "http://dicta.org.il/index.html"
		},
		toHome: function () {
			window.location = "#"
		},
		// for home screen:
		determineDragAndDropCapable(){
			var div = document.createElement('div')
			return ( ( 'draggable' in div )
          || ( 'ondragstart' in div && 'ondrop' in div ) )
          && 'FormData' in window
					&& 'FileReader' in window;
		},
		dropNewFile: function () {			
			console.log('dropped in drop zone')
		},
		processFiles: function () {
			if (this.filesReceived.length >= 2) {
				console.log('reached processFiles()')
				this.screen = "requesting"
				this.loading = true
				this.timedOut = false
				this.failed = false
				this.getSessionID()
			}
		},
		// for requesting screen:
		handleError: function (error) {
			console.log(error)
			if (error.message.substr(0,7) === 'timeout') {
				this.timedOut = true
				this.loading = false
				this.failed = false
			}
			else {
				this.loading = false
				this.timedOut = false
				this.failed = true
			}
		},
		getSessionID: function () {
			const httpClient = axios.create()
			httpClient.defaults.timeout = 45000
			httpClient.post(baseUrl + urlExtend + urlUpload + '/0', '').then((response) => {
				// console.log(response.data)
				if (((typeof response.data) !== 'object') || (!(response.data.hasOwnProperty('id')))) {
					this.loading = false
					this.timedOut = false
					this.failed = true
				} else {
					this.sessionID = response.data.id
					// console.log('Session ID is: ' + this.sessionID)
					// console.log( 'Next task: Upload text files.')
					this.nextUpload = 0
					this.uploadFiles()
				}
		  	}).catch(error => {
				this.handleError(error)
			})
		},
		uploadFiles: function () {
			console.log('running uploadFiles()')
			const url = baseUrl + urlExtend + urlUpload + '/' + this.sessionID
			let formData = new FormData()
			let filename = this.filesReceived[this.nextUpload].name
			// sendtext = this.submissionData[this.nextUpload]
			formData.append('file', this.filesReceived[this.nextUpload], filename, { type: 'text/plain' })
			// console.log(formData.getAll('file'))
			const httpClient = axios.create()
			httpClient.defaults.timeout = 45000
			httpClient.post(url, formData, { headers:  { 'Content-Type': 'multipart/form-data' } }).then((response) => {
				if (((typeof response.data) !== 'object') || (!(response.data.hasOwnProperty('uploads_success'))) || (response.data['uploads_success'].length === 0) || (response.data['uploads_success'][0] !== filename)) {
					this.loading = false
					this.timedOut = false
					this.failed = true
					console.log('API did not report upload successful!')
					console.log('response.data:')
					console.log(response.data)
				} else {
					console.log('API reported successful upload of: ' + filename)
					if (this.nextUpload < (this.filesReceived.length - 1)) {
						this.nextUpload += 1
						this.uploadFiles()
					} else {
						console.log('Next task: Get results.')
						this.getResults()
					}
				}
			}).catch(error => {
				this.handleError(error)
			})
		},
		getResults: function () {
			console.log('running getResults()')
			const url = baseUrl + urlExtend + '/' + this.sessionID
			const httpClient = axios.create()
			httpClient.defaults.timeout = 45000
			httpClient.post(url, '').then((response) => {
				if (((typeof response.data) !== 'object') || (!(response.data.hasOwnProperty('output_url'))) || (!(response.data.hasOwnProperty('top_items_alignment'))) || (!(response.data['top_items_alignment'].length > 0))) {
					this.loading = false
					this.timedOut = false
					this.failed = true
					console.log('API did not report upload successful!')
					console.log('response.data:')
					console.log(response.data)
				} else {
					this.excelURL = baseUrl + response.data["output_url"].substr(1)
					console.log('ExcelFile URL extension is: ' + this.excelURL)
					console.log('Next task: Display main file contents.')
					// this.top_items_alignment = response.data["top_items_alignment"]
					this.top_items_alignment = [[]]
					response.data["top_items_alignment"].forEach(row => {
						this.top_items_alignment.push(row.values)
					})
					this.loading = false
					this.currentPage = 1
					this.screen = 'results'
					// this.downloadExcelFile()
				}
			}).catch(error => {
				this.handleError(error)
			})
		},
		doShowRow: function (pageArrayIndex) {
			if (pageArrayIndex === -1) { return false }
			if (this.showAll) { return true }
			let arrayToTest = this.top_items_alignment[this.thisPageRowNumbers[pageArrayIndex]]
			if (!!arrayToTest.reduce(function(a, b){ return (a === b) ? a : NaN; })) { // tests if all values are identical
				return false
			} else return true
		},
		// FROM HERE ON - FROM OLD TEST PROGRAM AND NOT USED YET
		downloadExcelFile: function () {
		  console.log('running downloadExcelFile()')
		},
		runTest: function () {
	  	// this.testApiCall()
		  this.consoleText += 'Next task: Get submission filenames.' + this.newLine
		  this.getSubmissions()
    	  let description = this.submission1 + " vs. " + this.submission2
		  this.consoleText += 'Starting work on submission: ' + description + this.newLine
		  this.consoleText += 'Next task: Get session ID.' + this.newLine
	  	this.getSessionID()
		},
		getSubmissions: function () {
	  	this.submission1 = 'c:/Users/dovid/Documents/Dicta/Synoptic-related/resources/tzion-orig.txt'
		  this.submission2 = 'c:/Users/dovid/Documents/Dicta/Synoptic-related/resources/tzion-orig_mutated_1234.txt'
		  this.submissionData = {
				'submission1': 'for arguments sake ﻿צִיּוֹן, הֲלֹא תִשְׁאֲלִי לִשְׁלוֹם אֲסִירַיִךְ, דּוֹרְשֵׁי שְׁלוֹמֵךְ וְהֵם יֶתֶר עֲדָרָיִךְ? מִיָּם וּמִזְרָח וּמִצָּפוֹן וְתֵימָן שְׁלוֹם רָחוֹק וְקָרוֹב שְׂאִי מִכֹּל עֲבָרָיִךְ, וּשְׁלוֹם אֲסִיר תַּאֲוָה, נוֹתֵן דְּמָעָיו כְּטַל– חֶרְמוֹן וְנִכְסַף לְרִדְתָּם עַל הֲרָרָיִךְ! לִבְכּוֹת עֱנוּתֵךְ אֲנִי תַנִּים, וְעֵת אֶחֱלֹם שִׁיבַת שְׁבוּתֵך – אֲנִי כִנּוֹר לְשִׁירָיִךְ. לִבִּי לְבֵית-אֵל וְלִפְנִיאֵל מְאֹד יֶהֱמֶה וּלְמַחֲנַיִם וְכֹל פִּגְעֵי טְהוֹרָיִךְ, שָׁם הַשְּׁכִינָה שְׁכֵנָה לָךְ, וְהַיּוֹצְרֵךְ פָּתַח לְמוּל שַׁעֲרֵי שַׁחַק שְׁעָרָיִךְ, וּכְבוֹד אֲדֹנָי לְבַד הָיָה מְאוֹרֵךְ, וְאֵין שֶׁמֶשׁ וְסַהַר וְכוֹכָבִים מְאִירָיִךְ. אֶבְחַר לְנַפְשִׁי לְהִשְׁתַּפֵּךְ בְּמָקוֹם אֲשֶר רוּחַ אֱלֹהִים שְׁפוּכָה עַל בְּחִירָיִךְ. אַתְּ בֵּית מְלוּכָה וְאַתְּ כִּסֵּא אֲדֹנָי, וְאֵיךְ יָשְׁבוּ עֲבָדִים עֲלֵי כִסְאוֹת גְּבִירָיִךְ? מִי יִתְּנֵנִי מְשׁוֹטֵט בַּמְּקוֹמוֹת אֲשֶׁר נִגְלוּ אֱלֹהִים לְחוֹזַיִךְ וְצִירָיִךְ! מִי יַעֲשֶׂה לִי כְנָפַיִם וְאַרְחִיק נְדוֹד, אָנִיד לְבִתְרֵי לְבָבִי בֵּין בְּתָרָיִךְ! אֶפֹּל לְאַפַּי עֲלֵי אַרְצֵךְ וְאֶרְצֶה אֲבָ- נַיִךְ מְאֹד וַאֲחֹנֵן אֶת-עֲפָרָיִךְ, אַף כִּי בְעָמְדִי עֲלֵי קִבְרוֹת אֲבֹתַי וְאֶשְׁ- תּוֹמֵם בְּחֶבְרוֹן עֲלֵי מִבְחַר קְבָרָיִךְ! אֶעְבֹר בְּיַעְרֵךְ וְכַרְמִלֵּךְ וְאֶעְמֹד בְּגִלְ- עָדֵךְ וְאֶשְׁתּוֹמֲמָה אֶל הַר עֲבָרָיִךְ, הַר הָעֲבָרִים וְהֹר הָהָר, אֲשֶׁר שָׁם שְׁנֵי אוֹרִים גְּדוֹלִים מְאִירַיִךְ וּמוֹרָיִךְ. חַיֵּי נְשָׁמוֹת – אֲוִיר אַרְצֵךְ, וּמִמָּר דְרוֹר אַבְקַת עֲפָרֵךְ, וְנֹפֶת צוּף – נְהָרָיִךְ! יִנְעַם לְנַפְשִׁי הֲלֹךְ עָרֹם וְיָחֵף עֲלֵי חָרְבוֹת שְׁמָמָה אֲשֶׁר הָיוּ דְבִירָיִךְ, בִּמְקוֹם אֲרוֹנֵךְ אֲשֶׁר נִגְנַז, וּבִמְקוֹם כְּרוּ- בַיִךְ אֲשֶׁר שָׁכְנוּ חַדְרֵי חֲדָרָיִךְ!    אָגֹז וְאַשְׁלִיךְ פְּאֵר נִזְרִי וְאֶקֹּב זְמָן, חִלֵּל בְּאֶרֶץ טְמֵאָה אֶת-נְזִירָיִךְ– אֵיךְ יֶעֱרַב לִי אֲכֹל וּשְׁתוֹת בְּעֵת אֶחֱזֶה, כִּי יִּסְחֲבוּ הַכְּלָבִים אֶת-כְּפִירָיִךְ? אוֹ אֵיךְ מְאוֹר יוֹם יְהִי מָתוֹק לְעֵינַי בְּעוֹד אֶרְאֶה בְּפִי עֹרְבִים פִּגְרֵי נְשָׁרָיִךְ? כּוֹס הַיְגוֹנִים, לְאַט! הַרְפִּי מְעַט, כִּי כְבָר מָלְאוּ כְסָלַי וְנַפְשִׁי מַמְּרוֹרָיִךְ. עֵת אֶזְכְּרָה אָהֳלָה – אֶשְׁתֶּה חֲמָתֵךְ, וְאֶזְ- כֹּר אָהֳלִיבָה – וְאֶמְצֶה אֶת-שְׁמָרָיִךְ! צִיּוֹן כְּלִילַת יֳפִי, אַהְבָה וְחֵן תִּקְשְׁרִי מֵאָז, וּבָךְ נִקְשְׁרוּ נַפְשׁוֹת חֲבֵרָיִךְ– הֵם הַשְּׂמֵחִים לְשַׁלְוָתֵךְ וְהַכּוֹאֲבִים עַל שׁוֹמֲמוּתֵךְ וּבוֹכִים עַל שְׁבָרָיִךְ. מִבּוֹר שְׁבִי שׁוֹאֲפִים נֶגְדֵּךְ וּמִשְׁתַּחֲוִים אִישׁ מִמְּקוֹמוֹ אֱלֵי נֹכַח שְׁעָרָיִךְ, עֶדְרֵי הֲמוֹנֵךְ, אֲשֶׁר גָּלוּ וְהִתְפַּזְּרוּ מֵהַר לְגִבְעָה וְלֹא שָׁכְחוּ גְדֵרָיִךְ, הַמַּחֲזִיקִים בְּשׁוּלַיִךְ וּמִתְאַמְּצִים לַעְלוֹת וְלֶאְחֹז בְּסַנְסִנֵּי תְּמָרָיִךְ. שִׁנְעָר וּפַתְרוֹס הֲיַעַרְכוּךְ בְּגָדְלָם, וְאִם הֶבְלָם יְדַמּוּ לְתֻמַּיִךְ וְאוּרָיִךְ? אֶל מִי יְדַמּוּ מְשִׁיחַיִךְ וְאֶל מִי נְבִי- אַיִךְ וְאֶל מִי לְוִיַּיִךְ וְשָׁרָיִךְ? יִשְׁנֶה וְיַחְלֹף כְּלִיל כָּל-מַמְלְכוֹת הָאֱלִיל. חָסְנֵךְ לְעוֹלָם, לְדוֹר וָדוֹר נְזָרָיִךְ. אִוָּךְ לְמוֹשָׁב אֱלֹהַיִךְ, וְאַשְׁרֵי אֱנוֹשׁ יִבְחַר יְקָרֵב וְיִשְׁכֹּן בַּחֲצֵרָיִךְ! אַשְׁרֵי מְחַכֶּה וְיַגִּיעַ וְיִרְאֶה עֲלוֹת אוֹרֵךְ וְיִבָּקְעוּ עָלָיו שְׁחָרָיִךְ, לִרְאוֹת בְּטוֹבַת בְּחִירַיִךְ וְלַעְלֹז בְּשִׂמְ- חָתֵךְ בְּשׁוּבֵךְ אֱלֵי קַדְמַת נְעוּרָיִךְ!',
				'submission2': 'צִיּוֹן הֲלֹא תִשְׁאֲלִי א אֲסִירַיִךְ דּוֹרְשֵׁי שְׁלוֹמֵךְ וְהֵם יֶתֶ עֲדָרָיִךְ מִיָּם וּמִזְרָח וּמִצָּפוֹן וְתֵימָן שְׁלוֹם רָחוֹק וְקָרוֹב שְׂאִי מִכֹּל עֲבָרָיִךְ וּשְׁלוֹם אֲסִיר א דְּמָעָיו כְּטַל חֶרְמוֹן וְנִכְסַף לְרִדְתָּם עַל הֲרָרָיִךְ לִבְכּוֹת עֱנוּתֵךְ אֲנִי תַנִּים וְעֵת אֶחֱלֹם שִׁיבַת שְׁבוּתֵך אֲנִי כִנּוֹר לְשִׁירָיִךְ לִבִּי לְבֵית אֵל וְלִפְנִיאֵל מְאֹד יֶהֱמֶה וּלְמַחֲנַיִם וְכֹל פִּגְעֵי הַשְּׁכִינָה שְׁכֵנָה לָךְ לְמוּל שַׁעֲרֵי שַׁחַק שְׁעָרָיִךְ וּוֹד אֲדֹנָי לְבַד הָיָה א שֶׁמֶשׁ וְסַהַר וְכוֹכָבִים מְאִירָיִךְ לְנַפְשִׁי לְהִשְׁתַּפֵּךְ בְּמָקוֹם אֲשֶר רוּחַ אֱלֹהִים שְׁפוּכָה עַל בְּחִירָיִךְ אַתְּ בֵּית מְלוּכָה וְאַתְּ וְאֵיךְ יָשְׁבוּ עֲבָדִים עֲלֵי כִסְאוֹת גְּבִירָיִךְ מאִי יִתְּנֵנִי מְשׁוֹטֵט בַּמְּקוֹמוֹת אֲשֶׁר נִגְלוּ אֱלֹהִים לְחוֹזַיִךְ וְצִירָיִךְ מִי יַעֲשֶׂה לִי כְנָפַיִם וְאַרְחִיק נְדוֹד אָנִיד לְבִתְרֵי של לְבָבִי בֵּין בְּתָרָיִךְ אֶפֹּל לְאַפַּי אֲבָ נַיִךְ מְאֹד וַאֲחֹנֵן אֶת עֲפָרָיִךְ אַף כִּי בְעָמְדִי עֲלֵי קִבְרוֹת אֲבֹתַי וְאֶשְׁ תּוֹמֵם בְּחֶבְרוֹן עֲלֵי מִבְחַר א וְכַרְמִלֵּךְ וְאֶעְמֹד בְּגִלְ עָא וְאֶשְׁתּוֹמֲמָה אֶל הַר עֲבָרָיִךְ הַר הָעֲבָרִים וְהֹר הָהָר אֲשֶׁר שָׁם שְׁנֵי אוֹרִים גְּדוֹלִים מְאִירַיִךְ וּמוֹרָיִךְ חַיֵּי נְשָׁמוֹת אֲוִיר אַרְצֵךְ וּמִמָּר דְרוֹר אַבְקַת עֲפָרֵךְ וְנֹפֶת צוּף נְהָרָיִךְ יִנְעַם לְנַפְשִׁי הֲלֹךְ עָרֹאם וְיָחֵף עֲלֵי חָרְבוֹת שְׁמָמָה אֲש הָיוּ דְבִירָיִךְ בִּמְקוֹם אֲרוֹנֵךְ אֲשֶׁר נִגְנַז וּבִמְקוֹם כְּרוּ של בַיִךְ אֲשֶׁר שָׁכְנוּ חַדְרֵי חֲדָרָיִךְ אָגֹז וְאַשְׁלִיךְ פְּאֵר נִזאְרִי וְאֶקֹּב זְמָן חִלֵּל בְּאֶרֶץ טְמֵאָה אֶת נְזִירָיִךְ אֵיךְ יֶעֱרַב לִי אֲכֹל וּשְׁתוֹת בְּעֵת אֶחֱזֶה כִּי יִּסְחֲבוּ הַכְּלָבִים אֶת כְּפִירָיִךְ אוֹ אֵיךְ מְאוֹר יוֹם יְהִי מָתוֹק לְעֵינַי בְּעוֹד אֶרְאֶה בְּפא עֹרְבִים פִּגְרֵי נְשָׁרָיִךְ כּוֹס הַיְגוֹנִים לְאַט הַרְפִּי מְעַט כִּי כְבָר מָלְאוּ כְסָלַי וְנַפְשִׁי מַמְּרוֹרָיִךְ עֵת אֶזְכְּרָה אָהֳלָה אֶשְׁתֶּה חֲמָתֵךְ וְאֶזְ כֹּר אָהֳלִיבָה וְאֶמְצֶה אֶת שְׁמָרָיִךְ צִיּוֹן כְּלִילַת יֳפִי אַהְבָה וְחֵן תִּקְשְׁרִי מֵאָז וּבָךְ נִקְשְׁרוּ נַאת חֲבֵרָיִךְ הֵם הַשְּׂמֵחִים לְשַׁלְוָתֵךְ וְהַכּובִים עַל שׁוֹמֲמוּתֵךְ וּבוֹכִים עַל שְׁבָרָיִךְ מִבּוֹר שְׁבִי שׁוֹאֲפִים נְֶ וּמִשְׁתַּחֲוִים אִישׁ מִמְּקוֹמוֹ אֱלֵי נֹכַח שְׁעָרָיִךְ עֶדְרֵי הֲמוֹנֵךְ אֲשֶׁר גָּלוּ וְהִתְפַּזְּרוּ מֵהַר לְגִבְעָה וְלֹא שָׁכְחוּ גְדֵרָיִךְ הַמַּאֲזִיקִים בְּשׁוּלַיִךְ וּמִתְאַמְּצִים לַעְלוֹת וְלֶאְחֹז בְּסַנְסִנֵּי תְּמָרָיִךְ שִאׁנְעָר וּפַתְרוֹס הֲיַעַרְכוּךְ בְּגָדְלָם וְאִם הֶבְלָם יְדַמּוּ לְתֻמַּיִךְ וְאוּרָיִךְ אֶל מִי יְדַמּוּ מְשִׁיחַיִךְ של וְאֶל מִי נְבִי אַיִךְ וְאֶל מִי לְוִיַּיִךְ וְשָׁרָיִךְ יִשְׁנֶה ואף כְּלִיל כָּל מַמְלְכוֹת של הָאֱלִיל חָסְנֵךְ לְעוֹלָם לְדוֹר של וָדוֹר נְזָרָיִךְ אִוָּךְ לְמוֹשָׁב אֱלֹהַיִךְ וְאַשְׁרֵי אֱנוֹשׁ יִבְחַר יְקָרֵב וְיִשְׁכֹּן בַּחֲצֵרָיִךְ אַשְׁרֵי מְחַכֶּה וְיַגִּיעַ וְיִרְאֶה א עָלָיו שְׁחָרָיִךְ לִרְאוֹת בְּטוֹבַת בְּחִירַיִךְ וְלַעְלֹז בְּשִׂמְ חָתֵךְ בְּשׁוּבֵךְ אֱלֵי קַדְמַת נְעוּרָיִךְ'
		  }
		},
		clickInput: function () {
			$('#file-input').trigger('click')
		},
		pushInputtedFiles: function () {
			for( let i = 0; i < this.$refs.inputEl.files.length; i++ ){
				this.filesReceived.push( this.$refs.inputEl.files[i] );
			}
		},
		dragAndDropInit: function () {
			if( this.dragAndDropCapable ){
				$(document).on('dragover drop', function(e) {
			e.preventDefault();
			e.stopPropagation();
			e.originalEvent.dataTransfer.dropEffect = "none";
			});
				// Listen to all of the drag events and bind an event listener to each for the fileform.
				['drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach( function( evt ) {
					/* For each event add an event listener that prevents the default action
						(opening the file in the browser) and stop the propagation of the event (so
						no other elements open the file in the browser) */
					this.$refs.fileform.addEventListener(evt, function(e){
						e.preventDefault();
						e.stopPropagation();
					}.bind(this), false);
				}.bind(this));
				// Add an event listener for drop to the form
				this.$refs.fileform.addEventListener('drop', function(e){
					// Capture the files from the drop event and add them to our local files array.
					for( let i = 0; i < e.dataTransfer.files.length; i++ ){
						this.filesReceived.push( e.dataTransfer.files[i] );
					}
					console.log(this.filesReceived)
				}.bind(this));
			}	
		}
	},
	mounted () {
		this.dragAndDropCapable = this.determineDragAndDropCapable();
		// If drag and drop capable, then we continue to bind events to our elements.
		this.dragAndDropInit()
	}
})
