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


def draw_cover(c):
    c.setFillColor(GREEN)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(LIME)
    c.rect(54, 105, 9, PAGE_H - 210, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT, 31)
    c.drawString(88, PAGE_H - 165, "ECO DUMP")
    c.setFont(FONT, 24)
    c.drawString(88, PAGE_H - 211, "全画面 操作マニュアル")
    c.setFillColor(LIME)
    c.setFont(FONT, 13)
    c.drawString(90, PAGE_H - 248, "Transport Control Tower / 建設循環物流オペレーション")
    c.setFillColor(colors.HexColor("#B7CBC5"))
    c.setFont(FONT, 10)
    c.drawString(90, 116, "PCフルスクリーン版  |  ダークモード  |  2026年9月3日")
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
    c.setTitle("ECO DUMP 全画面 操作マニュアル")
    c.setAuthor("ECO DUMP")
    draw_cover(c)
    draw_overview(c)
    page_no = 3
    for filename, title, notes in PAGES:
        draw_header(c, title, page_no)
        draw_screen(c, SHOT_DIR / filename)
        draw_notes(c, notes)
        c.setFillColor(MUTED)
        c.setFont(FONT, 7)
        c.drawString(24, 20, "画面例はPC 1440×900。登録・更新操作は確認ダイアログの内容を確認して実行してください。")
        c.showPage()
        page_no += 1
    draw_appendix(c, page_no)
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
