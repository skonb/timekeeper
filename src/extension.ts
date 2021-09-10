"use strict";
import {window, commands, ViewColumn, ExtensionContext, StatusBarAlignment, StatusBarItem, TextDocument, Event, workspace, DiagnosticTag} from 'vscode';

const cats = {
    'codingCat': 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    'compilingCat': 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif'
  };

let timer: Timekeeper;
export function activate(context: ExtensionContext) {
    // create a new Timekeeper
    timer = new Timekeeper();

    //操作可能なステータスバー作成
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    //
    let showTime = () => {
        const dateStr = timer.getTimeStr();
        statusBarItem.text = dateStr;
        statusBarItem.show();
    };
    //定時実行
    setInterval(showTime, 10);
    
    //タイマーリセットコマンドの定義
    let resetId = "timekeeper.reset";
    statusBarItem.command = resetId;
    context.subscriptions.push(commands.registerCommand(resetId, () => {
        timer.reset(context);
    }));
    
    var disposable = commands.registerCommand('timekeeper.sayHello', () => {
        showTime();
    });
    // Add to a list of disposables which are disposed when this extension is deactivated.
    context.subscriptions.push(disposable);
    window.onDidChangeActiveTextEditor( (event) => {
        //console.log('onDidChangeActiveTextEditor');
    }, null, context.subscriptions);
    workspace.onDidChangeTextDocument(event => {
        timer.onDidChangeTextDocument();
        //console.log('onDidChangeTextDocument');
    }, null, context.subscriptions);

    //保存先の準備(もしなければ)
    if (context.globalState.keys().includes(timer.getTodayStr())) {
        //辞書で初期化
        context.globalState.update(timer.getTodayStr(), {});
    }
    commands.registerCommand('catCoding.start', () => {
        // Create and show a new webview
        const panel = window.createWebviewPanel(
            'catCoding', // Identifies the type of the webview. Used internally
            'Cat Coding', // Title of the panel displayed to the user
            ViewColumn.One, // Editor column to show the new webview panel in.
            {
                // Enable scripts in the webview
                enableScripts: true
            } // Webview options. More on these later.
        );

        let iteration = 0;
        const updateWebView = () => {
            const cat = iteration++ % 2 ? 'compilingCat' : 'codingCat';
            //const cat = iteration++ % 2 ? 'gura' : 'ame';
            panel.title = cat;
            let labels = ["1", "2", "3", "4", "5", "6"];
            let labelsStr = "[\" " + labels.join('\",\"')+"\"]";
            //panel.webview.html = getWebviewContent(cat);
            panel.webview.html = getWebviewContent(labelsStr);
        };
        updateWebView();
        setInterval(updateWebView, 1000);
        
    });
}
export function deactivate(context: ExtensionContext): undefined {
    timer.deactivate();
    return; 
}

class Timekeeper {
    
    private tmpTime=0;
    private tillStop = 0;
    private intervalId: NodeJS.Timer | null;
    constructor(){
        this.intervalId = setInterval(this.timerCount,1);
    }
    
    public getTodayStr() {
        let now = new Date();
        return `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
    }

    public getTimeStr(timeNum=this.tmpTime) :string{
        let sec = ('0'+String(Math.floor((timeNum)/1000)%60)).slice(-2);
        let min = ('0'+String(Math.floor((timeNum) / 1000 / 60) % 600)).slice(-2);
        let hour = ('0'+String(Math.floor((timeNum) / 1000 / 60 /60))).slice(-2);
        return `${('0'+String(hour)).slice(-2)}:${min}:${sec}`;
    }

    public onDidChangeTextDocument = () => {
        //タイマーストップを延長する
        this.tillStop=2000;
    };
    timerCount=()=> {
        if (this.tillStop >= 0) {
            this.tmpTime += 1;
            this.tillStop -= 1;
        }
    };
    /**
     * タイマーをリセットする．.
     * 
     * リセットと同時に，今までの時刻をストレージに記録し，
     * @param context 
     */
    public reset = (context: ExtensionContext) => {
        //前回のカウントアップ非同期処理を終了
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        //それまでのカウントを記録
        let languageId = window.activeTextEditor?.document.languageId;
        let filename = window.activeTextEditor?.document.fileName;
        let todayStr = this.getTodayStr();
        //保存先の準備(もしなければ)
        if (!context.globalState.keys().includes(timer.getTodayStr())) {
            //辞書で初期化
            context.globalState.update(timer.getTodayStr(), {});
        }
        //TODO TypeGuardで置き換える
        let storageDict = context.globalState.get(todayStr) as { [index:string]:{ [index: string]: number }};
        if (typeof languageId === 'string' && typeof filename === 'string') {
            if (!Object.keys(storageDict).includes(languageId)) {
                storageDict[languageId] = {};
            }
            let languageDict = storageDict[languageId];
            if (!Object.keys(languageDict).includes(filename)) {
                languageDict[filename] = 0;
            }
            languageDict[filename] += this.tmpTime;
        
            //それまでのカウントを表示
            window.showInformationMessage(`You have written a ${languageId} program "${filename}" for ${this.getTimeStr(storageDict[languageId][filename])} `);
        }        
        //保存
        context.globalState.update(todayStr,storageDict);

        //カウント初期化
        this.tmpTime=0;
        this.tillStop=0;

        //カウントアップ非同期処理の再割り当て
        this.intervalId = setInterval(this.timerCount,1);

    };
    public deactivate() {
        //カウントアップ非同期処理を終了
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
    
}
function getWebviewContent(labels:String) {
    console.log(labels);
    return `
    <html lang='ja'>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cat Coding</title>
        <script src="vscode-resource:/Users/Irene/programs/timekeeper/node_modules/chart.js/dist/chart.min.js"></script>
    </head>
    <body>
        <canvas id="myChart" width="400" height="400"></canvas>
    </body>
    <script>
        let ctx = document.getElementById("myChart").getContext('2d');
        let myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ${labels},
                datasets: [{
                    label: '得票数',
                    data: [12, 19, 3, 5, 2, 3],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(255, 206, 86, 0.2)',
                        'rgba(75, 192, 192, 0.2)',
                        'rgba(153, 102, 255, 0.2)',
                        'rgba(255, 159, 64, 0.2)'
                    ],
                    borderColor: [
                        'rgba(255,99,132,1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero:true
                        }
                    }]
                }
            }
        });
        </script>
  </html>
    `;
  }