from sqlmodel import Session,select
from app.models import ContentType,FieldDef

def seed_page_content_type(session:Session)->None:
    existing=session.exec(select(ContentType).where(ContentType.key=="page")).first()
    if existing:
        return
    
    page_type = ContentType(
        key="page",
        label="Page",
        description="Simple page for site (title, slug, body, SEO).",
        singleton=False,
    )

    session.add(page_type)
    session.commit()
    session.refresh(page_type)

    fields = [
        FieldDef(content_type_id=page_type.id,
                 name="title",
                 label="Title",
                 type="string",
                 required=True,
                 list=True,
                 filterable=True,
                 order_index=10),
        FieldDef(content_type_id=page_type.id,
                 name="slug",
                 label="Slug",
                 type="string",
                 required=True,
                 list=True,
                 filterable=True,
                 order_index=20,),
        FieldDef(content_type_id=page_type.id,
                 name="body",
                 label="Body",
                 type="text",
                 required=False,
                 list=False,
                 filterable=False,
                 order_index=30,),
        FieldDef(content_type_id=page_type.id,
                 name="seo_title",
                 label="SEO Title",
                 type="string",
                 required=False,
                 list=False,
                 filterable=False,
                 order_index=40,),
        FieldDef(content_type_id=page_type.id,
                 name="seo_description",
                 label="SEO Description",
                 type="text",
                 required=False,
                 list=False,
                 filterable=False,
                 order_index=50,)
    ]

    session.add_all(fields)
    session.commit()
