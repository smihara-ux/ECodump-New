from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
SHOT_DIR = ROOT / "output" / "manual" / "screenshots"
OUT_DIR = ROOT / "output" / "pdf"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / "ECODUMP_操作マニュアル_全画面版.pdf"

PAGE_W, PAGE_H = landscape(A4)
GREEN = colors.HexColor("#062D29")
GREEN_2 = colors.HexColor("#0D4540")
LIME = colors.HexColor("#D7E82F")
PALE = colors.HexColor("#EEF6F2")
MUTED = colors.HexColor("#60736E")
LINE = colors.HexColor("#C8D6D1")
WHITE = colors.white
BLACK = colors.HexColor("#12201D")

FONT = "HiraginoSans"
pdfmetrics.registerFont(
    TTFont(
        FONT,
        "/Applications/Microsoft Word.app/Contents/Resources/DFonts/YuGothR.ttc",
        subfontIndex=0,
    )
)

BODY = ParagraphStyle(
    "body", fontName=FONT, fontSize=8.3, leading=12, textColor=BLACK,
    alignment=TA_LEFT, spaceAfter=2,
)
SMALL = ParagraphStyle(
    "small", fontName=FONT, fontSize=7.2, leading=10, textColor=MUTED,
)


PAGES = [
    ("01-fields.png", "現場管理 - 現場一覧", [
        "1. 検索エリア: 現場名またはID、利用サービス、利用終了を含める条件で対象現場を絞り込みます。検索で反映、クリアで初期状態へ戻ります。",
        "2. 操作ユーザー選択: 自社または協力会社の操作対象ユーザーへ切り替えます。",
        "3. 現場名: クリックすると、その現場専用の運行マップと詳細画面を開きます。",
        "4. IDコピー: 現場ID横のコピーアイコンでIDをクリップボードへコピーします。",
        "5. 利用中のサービス: 書類、入退場、会議の各ボタンから該当サービスへ直接移動します。",
    ]),
    ("02-matching.png", "資源循環 - 発生土マッチ", [
        "1. 新しい案件を登録: 搬出または受入の案件情報を登録します。",
        "2. KPI: 公開中、受入可能、条件一致、成約見込みの件数を確認します。",
        "3. 条件検索: 種別、土質、エリアなどで候補を絞り込みます。詳細条件で追加条件を開きます。",
        "4. マッチング候補: 距離、受入可能量、適合度を比較し、案件詳細と受入条件を確認します。",
    ]),
    ("03-control.png", "運行管理 - 運行ダッシュボード", [
        "1. 配車を組む: 出発現場、受入場所、車両、運転手、荷種、予定積載量、出発時刻を登録します。",
        "2. フィルター: 現場、荷種、状態で地図とタイムラインを同時に絞り込みます。",
        "3. 運行マップ: 搬出現場から中間処分場・最終処分場までの道路経路と選択車両を表示します。",
        "4. 選択運行情報: 車両・運転手、荷種、予定積載量、実績積載量、距離、所要時間を確認します。",
        "5. タイムライン: 車両行を選択すると地図上の経路が切り替わります。詳細で運行情報を確認します。",
        "6. 運行サマリー: 予定、配車済み、運行中、遅延、待機、受入完了の集計です。",
    ]),
    ("04-labor.png", "現場サービス - 労務安全", [
        "1. 左の中項目: 書類状況、教育報告、元請帳票、協力会社・作業員検索、是正依頼、書類出力を切り替えます。",
        "2. 書類タブ: 一括提出、個別提出、許可情報、契約情報、保険加入証明、主任技術者を切り替えます。",
        "3. 一覧: 提出状況、次数、会社名、コメント、提出操作、各確認状況を表示します。",
        "4. 確認・提出・取下げ: 対象書類の確認や提出状態の更新を行います。",
    ]),
    ("05-gatekeeper.png", "現場サービス - 入退場管理", [
        "1. ダッシュボード: 現場情報と当日の入退場状況を確認します。",
        "2. 入退場履歴: 作業員・車両の入場時刻、退場時刻、滞在状態を確認します。",
        "3. 顔認証ユーザー: 現場で利用する認証ユーザーを管理します。",
        "4. 共通メニュー: サービス横断で利用する関連機能を開きます。",
    ]),
    ("06-conference.png", "現場サービス - 調整会議", [
        "1. ダッシュボード: 会議対象現場と現在の調整状況を確認します。",
        "2. 作業予定一覧: 日付ごとの作業内容、担当会社、時間帯を確認します。",
        "3. 搬出予定一覧: 搬出先、車両、予定台数、時間帯を確認します。",
        "4. 新規メニュー: 新しい会議予定や調整項目を登録します。",
    ]),
    ("07-transport.png", "運行業務 - 搬出・受入管理", [
        "1. 当日・翌日: 表示対象日を切り替えます。",
        "2. 現場別・受入場所別: 集計軸を切り替え、予定延べ台数を確認します。",
        "3. 絞り込み: 現場、混雑状況、現場・受入場所・車両のキーワードで対象を絞ります。",
        "4. サマリー: 当日の延べ台数、空き、混雑注意、運行予定時間を表示します。",
        "5. 内訳を表示: 予定台数と実車両数の内訳を確認します。予定を追加で新規登録します。",
    ]),
    ("08-company.png", "基本台帳 - 会社情報", [
        "1. 基本情報: 会社名、法人番号、住所、電話番号などの登録情報を確認します。",
        "2. CCUS連携情報: 建設キャリアアップシステム関連の登録状態を確認します。",
        "3. 編集: 編集ボタンから会社情報を更新します。",
    ]),
    ("09-users.png", "基本台帳 - ユーザー", [
        "1. 検索: 氏名、メールアドレス、権限、状態でユーザーを絞り込みます。",
        "2. 新規作成: 利用者の基本情報と権限を登録します。",
        "3. 一覧: 氏名、連絡先、権限、登録日、最終利用日を確認します。",
        "4. 確認: 対象ユーザーの詳細を開き、編集や利用状態の確認を行います。",
    ]),
    ("10-vehicles.png", "基本台帳 - 車両・運転手", [
        "1. 車両情報タブ: 車両名、車両番号、種別、最大積載量、利用状況を管理します。",
        "2. 運転手情報タブ: 運転手名、連絡先、所属、資格・状態を管理します。",
        "3. 検索: 車両番号、運転手名、所属会社、状態で絞り込みます。",
        "4. 新規登録・確認: 車両または運転手を登録し、既存情報を確認・編集します。",
    ]),
    ("11-agencies.png", "関係会社 - 協力会社", [
        "1. 検索: 会社名、状態、利用終了条件で対象会社を絞り込みます。",
        "2. 一覧: 協力会社情報、利用期間、担当者、状態を確認します。",
        "3. 詳細: 二次協力会社の配下に登録された三次協力会社の状態も階層で確認します。",
        "4. 操作: 詳細確認や必要な編集を行います。",
    ]),
    ("12-agency-request.png", "関係会社 - 登録申請", [
        "1. 新規申請: 協力会社の登録申請を作成します。",
        "2. Word・PDF出力: 申請情報を指定形式で出力します。",
        "3. 一覧: 申請先、担当会社、申請日、ステータス、回答期限を確認します。",
        "4. 確認: 申請内容の詳細と進捗を開きます。",
    ]),
    ("13-prime-contractors.png", "関係会社 - 元請会社", [
        "1. 検索: 元請会社名と利用終了条件で対象を絞り込みます。",
        "2. 一覧: 元請会社、現場、連絡先、利用状態を確認します。",
        "3. 詳細確認: 自社に対する元請会社からの登録・利用関係を確認します。",
    ]),
    ("14-field-detail.png", "現場詳細 - 現場別運行マップ", [
        "1. 現場ヘッダー: 現場名、住所、工期、ステータスを確認します。",
        "2. タブ: 運行マップ、概要、協力会社、入退場、搬出・受入、車両・運転手を切り替えます。",
        "3. 現場別マップ: 選択現場から受入場所までの道路経路と対象車両を表示します。",
        "4. 当日集計: 現場単位の予定、運行中、遅延、完了の延べ台数を確認します。",
        "5. 運行詳細: 荷種、予定積載量、実績積載量、車両、運転手、到着予定を確認します。",
    ]),
]

DETAILS = {
    "01-fields.png": {
        "purpose": "利用可能な現場を検索し、現場詳細または現場サービスへ移動する起点画面です。",
        "steps": [
            "現場名/ID欄に名称の一部または現場IDを入力します。",
            "必要に応じて利用サービスと「利用終了を含める」を指定します。",
            "検索を押し、検索結果件数と一覧の内容を確認します。",
            "現場名を押すと現場別運行マップへ移動します。書類・入退場・会議は右端のボタンから直接開けます。",
            "別会社として操作する場合だけ、操作ユーザー選択から対象ユーザーを選択します。",
        ],
        "check": "現場名、現場ID、住所、工期、稼働状態、利用サービスが対象現場と一致していること。",
        "tips": "条件を戻す場合はクリアを使用します。IDコピーは問い合わせや他システムとの照合に利用します。",
    },
    "02-matching.png": {
        "purpose": "発生土の搬出案件と受入案件を、土質・数量・場所・期間・距離から比較する画面です。",
        "steps": [
            "搬出先を探す場合は搬出案件、土を受け入れる場合は受入案件の表示モードを選びます。",
            "土質、エリア、期間などの条件を指定し、候補を絞り込みます。",
            "候補カードを選択し、適合度、距離、受入可能量、条件不一致の理由を確認します。",
            "詳細を開いて連絡条件と注意事項を確認し、候補として保存または交渉へ進みます。",
            "新規案件は、種別、現場、数量、期間、土質、希望条件を入力して登録します。",
        ],
        "check": "数量の単位、受入可能期間、土質区分、運搬距離が実案件と一致していること。",
        "tips": "適合度だけで確定せず、受入条件と搬出期間を必ず確認します。",
    },
    "03-control.png": {
        "purpose": "配車、道路ルート、現在位置、遅延、受入完了までを一画面で管制します。",
        "steps": [
            "配車を組むを押し、出発現場、受入場所、車両、運転手を選択します。",
            "荷種、予定積載量、出発予定時刻を入力し、内容確認後に登録します。",
            "タイムラインで運行便を選択すると、地図が選択車両の道路ルートへ切り替わります。",
            "地図上の選択運行カードで車両、運転手、荷種、積載量、距離、所要時間を確認します。",
            "遅延便はオレンジ表示を確認し、詳細から到着見込みと影響先を確認します。",
            "現場・荷種・状態フィルターを変更し、対象便だけを表示します。",
        ],
        "check": "出発地と受入先、車両番号、運転手、積載量、予定時刻、現在の運行状態。",
        "tips": "地図の線は道路経路です。選択便を変えるとルートと詳細が連動します。",
    },
    "04-labor.png": {
        "purpose": "安全書類の提出、確認、差戻し、教育報告、是正対応をまとめて管理します。",
        "steps": [
            "左の中項目から確認する業務を選びます。",
            "書類状況一覧では上部タブで対象書類種別を切り替えます。",
            "会社名と次数を確認し、確認ボタンで提出内容を開きます。",
            "不足があればコメントを記入して差戻し、問題なければ受領します。",
            "新規入場時教育は新規作成から実施日と対象者を登録します。",
            "必要に応じて検索、Excel出力、書類一括出力を利用します。",
        ],
        "check": "会社の次数、対象現場、書類の有効期限、未提出・差戻し状態。",
        "tips": "二次会社配下の三次会社は階層と次数を確認してから処理します。",
    },
    "05-gatekeeper.png": {
        "purpose": "現場へ入退場する作業員と車両の実績、認証利用者を確認します。",
        "steps": [
            "ダッシュボードで当日の入場中人数、退場済み、未退場を確認します。",
            "入退場履歴へ移動し、日付・氏名・車両番号で対象記録を検索します。",
            "行を選択して入場時刻、退場時刻、滞在時間、認証方法を確認します。",
            "顔認証ユーザーでは利用者の登録状態と所属会社を確認します。",
            "共通メニューから現場掲示板などの関連機能を開きます。",
        ],
        "check": "未退場者、重複記録、所属会社、本人確認状態、車両の入退場時刻。",
        "tips": "現場終業時は未退場者が残っていないか必ず確認します。",
    },
    "06-conference.png": {
        "purpose": "翌日以降の作業、搬出入、会社間の時間調整を会議単位で管理します。",
        "steps": [
            "対象日と現場を選び、作業予定一覧を開きます。",
            "新規登録から作業内容、会社、責任者、時間帯、使用場所を入力します。",
            "搬出予定一覧で搬出先、予定台数、車両、時間帯を確認します。",
            "時間帯や場所が重複する場合は警告内容を確認して調整します。",
            "確定後、会議参加者へ共有する内容を確認します。",
        ],
        "check": "日付、時間帯、作業場所、会社、責任者、搬出入台数、競合の有無。",
        "tips": "登録前に同時間帯の搬出入と重機作業を確認すると混雑を防げます。",
    },
    "07-transport.png": {
        "purpose": "現場別・受入場所別に当日と翌日の予定延べ台数、実車両数、混雑を確認します。",
        "steps": [
            "当日または翌日を選択します。",
            "現場別と受入場所別を切り替え、必要な集計軸を選びます。",
            "現場、混雑状況、キーワードで絞り込みます。",
            "一覧で予定延べ台数、実車両数、運行時間、受入先数を確認します。",
            "内訳を表示し、便ごとの車両、運転手、受入先、予定時刻を確認します。",
            "予定を追加から新しい搬出・受入予定を登録します。",
        ],
        "check": "延べ台数と実車両数の違い、受入可能枠、混雑注意、運行予定時間。",
        "tips": "同じ車両が複数往復する場合、延べ台数は実車両数より多くなります。",
    },
    "08-company.png": {
        "purpose": "自社の基本情報、支店、許可、CCUS、安全関連情報を確認・更新します。",
        "steps": [
            "タブを切り替えて基本情報、CCUS情報、安全情報、支店情報を確認します。",
            "編集を押し、変更する項目のみを修正します。",
            "法人番号、郵便番号、電話番号などの形式を確認します。",
            "保存前の確認画面で変更内容を確認し、確定します。",
        ],
        "check": "正式会社名、法人番号、所在地、代表連絡先、許可期限、CCUS登録状態。",
        "tips": "会社名や法人番号の変更は関連帳票へ影響するため、保存前に再確認します。",
    },
    "09-users.png": {
        "purpose": "ECO DUMPを利用する管理者・担当者のアカウントと権限を管理します。",
        "steps": [
            "氏名、メール、権限、状態で対象ユーザーを検索します。",
            "新規作成から氏名、所属、連絡先、権限を入力します。",
            "確認ボタンでユーザー詳細を開き、登録内容と最終利用日を確認します。",
            "必要な場合は権限または利用状態を変更し、保存します。",
        ],
        "check": "メールアドレス、所属、付与権限、利用中・停止中の状態。",
        "tips": "業務に必要な最小権限を付与し、退職・異動時は利用状態を更新します。",
    },
    "10-vehicles.png": {
        "purpose": "運行に使用する車両と運転手を登録し、配車で選択可能な状態にします。",
        "steps": [
            "車両情報または運転手情報タブを選びます。",
            "検索欄で車両番号、運転手名、所属、状態を絞り込みます。",
            "新規登録から車両番号、種別、最大積載量、所属会社を登録します。",
            "運転手は氏名、連絡先、所属、資格情報を登録します。",
            "確認を押して詳細を開き、必要な情報を編集します。",
        ],
        "check": "車両番号、最大積載量、所属、運転手資格、有効期限、稼働状態。",
        "tips": "最大積載量は配車時の予定積載量チェックに使用します。",
    },
    "11-agencies.png": {
        "purpose": "協力会社と、その配下に登録された二次・三次協力会社の関係を管理します。",
        "steps": [
            "会社名または状態で協力会社を検索します。",
            "対象会社の詳細を開き、担当者、利用期間、登録状態を確認します。",
            "二次協力会社を展開し、その下に表示される三次協力会社を確認します。",
            "所属関係や状態を更新する場合は編集し、確認後に保存します。",
        ],
        "check": "一次・二次・三次の次数、上位会社、担当者、利用期間、承認状態。",
        "tips": "同名会社がある場合は法人番号や所在地も照合します。",
    },
    "12-agency-request.png": {
        "purpose": "協力会社への登録依頼を作成し、回答・承認までの進捗を管理します。",
        "steps": [
            "新規申請を押し、申請先会社、担当者、対象現場、回答期限を入力します。",
            "確認画面で送付内容を確認して登録します。",
            "一覧で未回答、確認中、承認済みなどの状態を確認します。",
            "確認から申請詳細を開き、必要に応じて再案内します。",
            "外部共有が必要な場合はWordまたはPDFで出力します。",
        ],
        "check": "申請先、対象現場、回答期限、現在のステータス、最終更新日時。",
        "tips": "再案内前に、既に回答済みになっていないか最新状態を確認します。",
    },
    "13-prime-contractors.png": {
        "purpose": "自社を協力会社として登録している元請会社と現場の関係を確認します。",
        "steps": [
            "元請会社名または終了条件を指定して検索します。",
            "一覧で元請会社、対象現場、担当者、利用状態を確認します。",
            "詳細を開き、登録関係と利用可能サービスを確認します。",
        ],
        "check": "元請会社名、対象現場、担当者、利用開始・終了、利用サービス。",
        "tips": "対象現場が表示されない場合は、元請側の登録状態と操作ユーザーを確認します。",
    },
    "14-field-detail.png": {
        "purpose": "選択した現場だけに絞り、運行・協力会社・入退場・搬出入を横断確認します。",
        "steps": [
            "現場一覧で現場名を押してこの画面を開きます。",
            "ヘッダーで現場名、住所、工期、稼働状態を確認します。",
            "運行マップで対象便を選び、道路ルート、車両位置、受入先を確認します。",
            "概要、協力会社、入退場、搬出・受入、車両・運転手の各タブを切り替えます。",
            "運行詳細で荷種、予定・実績積載量、運転手、到着予定を確認します。",
            "戻るを押すと、検索条件を保った現場一覧へ戻ります。",
        ],
        "check": "対象現場を間違えていないこと、当日便数、遅延、受入先、積載実績。",
        "tips": "現場ごとの日常確認は、この画面を起点にすると移動回数を減らせます。",
    },
}


def draw_header(c, title, page_no):
    c.setFillColor(GREEN)
    c.rect(0, PAGE_H - 48, PAGE_W, 48, fill=1, stroke=0)
    c.setFillColor(LIME)
    c.rect(20, PAGE_H - 36, 5, 23, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT, 15)
    c.drawString(34, PAGE_H - 31, title)
    c.setFont(FONT, 8)
    c.drawRightString(PAGE_W - 22, PAGE_H - 28, f"ECO DUMP 操作マニュアル  |  {page_no}")


def draw_screen(c, path):
    img = ImageReader(str(path))
    iw, ih = img.getSize()
    box_x, box_y, box_w, box_h = 22, 205, PAGE_W - 44, PAGE_H - 267
    scale = min(box_w / iw, box_h / ih)
    w, h = iw * scale, ih * scale
    x = box_x + (box_w - w) / 2
    y = box_y + (box_h - h) / 2
    c.setStrokeColor(GREEN_2)
    c.setLineWidth(1.2)
    c.rect(x - 2, y - 2, w + 4, h + 4, fill=0, stroke=1)
    c.drawImage(img, x, y, w, h, preserveAspectRatio=True, mask="auto")


def draw_notes(c, notes):
    c.setFillColor(PALE)
    c.roundRect(22, 37, PAGE_W - 44, 151, 8, fill=1, stroke=0)
    col_w = (PAGE_W - 62) / 2
    left = notes[: (len(notes) + 1) // 2]
    right = notes[(len(notes) + 1) // 2 :]
    for col, items in enumerate((left, right)):
        x = 34 + col * (col_w + 12)
        y = 171
        for item in items:
            p = Paragraph(item, BODY)
            _, h = p.wrap(col_w, 50)
            p.drawOn(c, x, y - h)
            y -= h + 7


def draw_text_block(c, x, y, width, title, lines, accent=False):
    c.setFillColor(LIME if accent else GREEN_2)
    c.roundRect(x, y - 28, width, 28, 5, fill=1, stroke=0)
    c.setFillColor(GREEN if accent else WHITE)
    c.setFont(FONT, 10)
    c.drawString(x + 10, y - 19, title)
    cursor = y - 42
    for index, line in enumerate(lines, 1):
        c.setFillColor(LIME)
        c.circle(x + 12, cursor - 2, 8, fill=1, stroke=0)
        c.setFillColor(GREEN)
        c.setFont(FONT, 6.8)
        c.drawCentredString(x + 12, cursor - 4.5, str(index))
        paragraph = Paragraph(line, ParagraphStyle(
            f"detail-{title}-{index}", parent=BODY, fontSize=8.2, leading=11.5
        ))
        _, height = paragraph.wrap(width - 39, 56)
        paragraph.drawOn(c, x + 28, cursor - height + 4)
        cursor -= max(30, height + 10)
    return cursor


def draw_detail_page(c, filename, title, page_no):
    detail = DETAILS[filename]
    draw_header(c, f"{title} - 詳細操作", page_no)
    margin = 28
    content_top = PAGE_H - 68
    c.setFillColor(PALE)
    c.roundRect(margin, content_top - 70, PAGE_W - margin * 2, 62, 8, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont(FONT, 10)
    c.drawString(margin + 14, content_top - 29, "この画面の目的")
    purpose = Paragraph(detail["purpose"], ParagraphStyle(
        f"purpose-{filename}", parent=BODY, fontSize=11, leading=15
    ))
    purpose.wrap(PAGE_W - 220, 40)
    purpose.drawOn(c, margin + 118, content_top - 44)

    left_x, left_w = margin, 500
    draw_text_block(c, left_x, content_top - 88, left_w, "基本操作 - 上から順に実行", detail["steps"])

    right_x = left_x + left_w + 18
    right_w = PAGE_W - margin - right_x
    draw_text_block(c, right_x, content_top - 88, right_w, "確認する項目", [detail["check"]], accent=True)
    draw_text_block(c, right_x, content_top - 190, right_w, "操作上の注意・ヒント", [detail["tips"]])
    draw_text_block(c, right_x, content_top - 305, right_w, "共通ルール", [
        "ライム色は主要操作、枠線ボタンは確認・補助操作です。",
        "登録・変更・削除は確認ダイアログの対象と内容を確認してから確定します。",
        "表示が更新されない場合は、検索条件と選択中の現場・日付を確認します。",
    ])
    c.setFillColor(MUTED)
    c.setFont(FONT, 7)
    c.drawString(margin, 20, "権限によって表示されるボタンや操作範囲が異なる場合があります。")
    c.showPage()


def draw_quick_start(c, page_no):
    draw_header(c, "初回利用 - 5分で始める基本手順", page_no)
    steps = [
        ("1", "対象プロジェクトを選ぶ", "上部のプロジェクト選択を開き、操作する現場群を選択します。"),
        ("2", "現場を検索する", "現場管理 - 現場一覧で現場名またはIDを入力し、検索を押します。"),
        ("3", "現場詳細を開く", "一覧の現場名を押し、現場別運行マップと当日の状態を確認します。"),
        ("4", "運行を確認・登録する", "運行ダッシュボードで便を選ぶか、配車を組むから新規予定を登録します。"),
        ("5", "関連業務を確認する", "労務安全、入退場、調整会議、搬出・受入管理へサイドバーから移動します。"),
    ]
    y = PAGE_H - 92
    for number, title, description in steps:
        c.setFillColor(PALE)
        c.roundRect(48, y - 66, PAGE_W - 96, 56, 8, fill=1, stroke=0)
        c.setFillColor(LIME)
        c.circle(77, y - 38, 16, fill=1, stroke=0)
        c.setFillColor(GREEN)
        c.setFont(FONT, 11)
        c.drawCentredString(77, y - 42, number)
        c.setFont(FONT, 11)
        c.drawString(108, y - 31, title)
        c.setFillColor(MUTED)
        c.setFont(FONT, 8.5)
        c.drawString(108, y - 49, description)
        y -= 77
    c.showPage()


def draw_status_guide(c, page_no):
    draw_header(c, "表示ルール - 状態・色・件数の読み方", page_no)
    rows = [
        ("ライム", "主要操作・選択中・正常進行", "検索、登録、選択中メニュー、運行中など"),
        ("オレンジ", "注意・遅延・受入中", "遅延時間、混雑注意、受入処理中など"),
        ("赤", "エラー・停止・至急確認", "入力エラー、運行停止、期限超過など"),
        ("グレー", "待機・未設定・利用不可", "待機中、データ未登録、権限外の操作など"),
        ("延べ台数", "便の総回数", "同じ車両が3往復した場合は3台として集計"),
        ("実車両数", "重複を除いた車両数", "同じ車両が3往復しても1台として集計"),
    ]
    x, y = 48, PAGE_H - 100
    widths = [105, 220, PAGE_W - 421]
    for label, meaning, example in rows:
        c.setFillColor(PALE)
        c.roundRect(x, y - 48, sum(widths), 42, 6, fill=1, stroke=0)
        c.setFillColor(LIME if label == "ライム" else GREEN_2)
        c.roundRect(x + 8, y - 39, 88, 25, 5, fill=1, stroke=0)
        c.setFillColor(GREEN if label == "ライム" else WHITE)
        c.setFont(FONT, 8.5)
        c.drawCentredString(x + 52, y - 31, label)
        c.setFillColor(BLACK)
        c.setFont(FONT, 9)
        c.drawString(x + widths[0] + 8, y - 31, meaning)
        c.setFillColor(MUTED)
        c.setFont(FONT, 8)
        c.drawString(x + widths[0] + widths[1] + 8, y - 31, example)
        y -= 58
    c.showPage()


def draw_troubleshooting(c, page_no):
    draw_header(c, "困ったとき - よくある確認事項", page_no)
    items = [
        ("現場が表示されない", "検索条件をクリアし、プロジェクトと操作ユーザーを確認します。利用終了を含める設定も確認します。"),
        ("ボタンが押せない", "必須項目、利用権限、対象データの状態を確認します。グレー表示は利用不可または未設定です。"),
        ("地図の経路が出ない", "運行便を選択し、出発現場と受入場所が登録されていることを確認します。"),
        ("件数が合わない", "対象日、現場別・受入場所別、フィルターを確認します。延べ台数と実車両数は集計方法が異なります。"),
        ("文字が見にくい", "テーマ切替でライト・ダークを変更し、ブラウザ倍率を100%へ戻します。"),
        ("スマートフォンでメニューが見えない", "画面左上のメニューボタンを押してサイドメニューを開きます。"),
    ]
    y = PAGE_H - 92
    for title, answer in items:
        c.setFillColor(PALE)
        c.roundRect(44, y - 58, PAGE_W - 88, 50, 7, fill=1, stroke=0)
        c.setFillColor(GREEN)
        c.setFont(FONT, 9.5)
        c.drawString(58, y - 27, title)
        c.setFillColor(MUTED)
        c.setFont(FONT, 8)
        c.drawString(232, y - 27, answer)
        y -= 67
    c.showPage()


def draw_cover(c):
    c.setFillColor(GREEN)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(LIME)
    c.rect(54, 105, 9, PAGE_H - 210, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT, 31)
    c.drawString(88, PAGE_H - 165, "ECO DUMP")
    c.setFont(FONT, 24)
    c.drawString(88, PAGE_H - 211, "全画面 詳細操作マニュアル")
    c.setFillColor(LIME)
    c.setFont(FONT, 13)
    c.drawString(90, PAGE_H - 248, "Transport Control Tower / 建設循環物流オペレーション")
    c.setFillColor(colors.HexColor("#B7CBC5"))
    c.setFont(FONT, 10)
    c.drawString(90, 116, "PCフルスクリーン詳細版  |  ダークモード  |  2026年9月3日")
    c.drawString(90, 96, "対象: 現場管理・運行管理・現場サービス・基本台帳・関係会社")
    c.showPage()


def draw_overview(c):
    draw_header(c, "はじめに - 共通画面と基本操作", 2)
    items = [
        "上部バー: プロジェクト選択、日付切替、全体検索、テーマ切替、通知、ヘルプを利用します。",
        "左サイドバー: 現場一覧、発生土マッチ、運行ダッシュボード、現場サービス、基本台帳、関係会社へ移動します。",
        "ライム色のボタン: 登録、検索、配車確定など、その画面の主要操作です。",
        "枠線ボタン: 詳細表示、条件指定、確認などの補助操作です。",
        "ライト・ダークモード: 上部のテーマボタンで切り替えます。設定は同じ端末のブラウザに保存されます。",
        "PC以外: iPad・タブレットではサイドバーが縮小し、スマートフォンではメニューから開きます。機能と遷移先は共通です。",
    ]
    c.setFillColor(PALE)
    c.roundRect(36, 85, PAGE_W - 72, PAGE_H - 160, 12, fill=1, stroke=0)
    y = PAGE_H - 105
    for i, item in enumerate(items, 1):
        c.setFillColor(LIME)
        c.circle(65, y + 4, 12, fill=1, stroke=0)
        c.setFillColor(GREEN)
        c.setFont(FONT, 9)
        c.drawCentredString(65, y + 1, str(i))
        p = Paragraph(item, ParagraphStyle("overview", parent=BODY, fontSize=11, leading=17))
        _, h = p.wrap(PAGE_W - 145, 55)
        p.drawOn(c, 92, y - h + 10)
        y -= 65
    c.showPage()


def draw_appendix(c, page_no):
    draw_header(c, "追加実装 - 荷種・積載量・運搬実績", page_no)
    c.setFillColor(PALE)
    c.roundRect(30, 80, PAGE_W - 60, PAGE_H - 155, 12, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont(FONT, 18)
    c.drawString(55, PAGE_H - 105, "添付要望との照合結果")
    rows = [
        ("既存", "搬出現場・受入場所のマップ表示", "現場別運行マップと運行ダッシュボードで利用可能"),
        ("既存", "ダンプ車両の追跡・道路経路", "タイムラインの車両を選択すると道路ルートへ連動"),
        ("既存", "現場別・受入場所別の予定延べ台数", "搬出・受入管理の表示切替で確認可能"),
        ("追加", "荷種", "配車登録、地図の選択運行、運行詳細に表示"),
        ("追加", "予定積載量", "配車登録時にm³単位で入力し、運行情報へ保存"),
        ("追加", "実績積載量", "受入中・完了便の計量実績を運行情報に表示"),
        ("追加", "車両・運転手とのひも付け", "選択運行カードと詳細画面で同時確認"),
    ]
    x0, y0 = 55, PAGE_H - 145
    widths = [60, 225, PAGE_W - 370]
    headers = ["状態", "項目", "実装・確認場所"]
    c.setFillColor(GREEN_2)
    c.rect(x0, y0 - 30, sum(widths), 30, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT, 9)
    x = x0
    for text, w in zip(headers, widths):
        c.drawString(x + 8, y0 - 20, text)
        x += w
    y = y0 - 30
    for status, name, detail in rows:
        c.setFillColor(WHITE)
        c.rect(x0, y - 42, sum(widths), 42, fill=1, stroke=0)
        c.setStrokeColor(LINE)
        c.line(x0, y - 42, x0 + sum(widths), y - 42)
        c.setFillColor(LIME if status == "追加" else colors.HexColor("#DDE9E5"))
        c.roundRect(x0 + 8, y - 31, 40, 22, 5, fill=1, stroke=0)
        c.setFillColor(GREEN)
        c.setFont(FONT, 8)
        c.drawCentredString(x0 + 28, y - 24, status)
        name_p = Paragraph(name, BODY)
        name_p.wrap(widths[1] - 16, 32)
        name_p.drawOn(c, x0 + widths[0] + 8, y - 30)
        detail_p = Paragraph(detail, BODY)
        detail_p.wrap(widths[2] - 16, 32)
        detail_p.drawOn(c, x0 + widths[0] + widths[1] + 8, y - 30)
        y -= 42
    c.setFillColor(MUTED)
    c.setFont(FONT, 8)
    c.drawString(55, 98, "実運用では計量器・GPS・入退場機器・車両台帳とのAPI連携が必要です。現在はフロントエンド動作確認用データです。")
    c.showPage()


def build():
    c = canvas.Canvas(str(OUT), pagesize=landscape(A4), pageCompression=1)
    c.setTitle("ECO DUMP 全画面 詳細操作マニュアル")
    c.setAuthor("ECO DUMP")
    draw_cover(c)
    draw_overview(c)
    draw_quick_start(c, 3)
    page_no = 4
    for filename, title, notes in PAGES:
        draw_header(c, title, page_no)
        draw_screen(c, SHOT_DIR / filename)
        draw_notes(c, notes)
        c.setFillColor(MUTED)
        c.setFont(FONT, 7)
        c.drawString(24, 20, "画面例はPC 1440×900。登録・更新操作は確認ダイアログの内容を確認して実行してください。")
        c.showPage()
        page_no += 1
        draw_detail_page(c, filename, title, page_no)
        page_no += 1
    draw_status_guide(c, page_no)
    page_no += 1
    draw_troubleshooting(c, page_no)
    page_no += 1
    draw_appendix(c, page_no)
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
