Facets
Facets are deprecated and will be removed in a future release. You are encouraged to migrate to aggregations instead.

The usual purpose of a full-text search engine is to return a small number of documents matching your query.

Facets provide aggregated data based on a search query. In the simplest case, a terms facet can return facet counts for various facet values for a specific field. Elasticsearch supports more facet implementations, such as statistical or date histogram facets.

The field used for facet calculations must be of type numeric, date/time or be analyzed as a single token — see the Mapping guide for details on the analysis process.

You can give the facet a custom name and return multiple facets in one request.

Let’s try it out with a simple example. Suppose we have a number of articles with a field called tags, preferably analyzed with the keyword analyzer. The facet aggregation will return counts for the most popular tags across the documents matching your query — or across all documents in the index.

We will store some example data first:

curl -X DELETE "http://localhost:9200/articles"
curl -X POST "http://localhost:9200/articles/article" -d '{"title" : "One",   "tags" : ["foo"]}'
curl -X POST "http://localhost:9200/articles/article" -d '{"title" : "Two",   "tags" : ["foo", "bar"]}'
curl -X POST "http://localhost:9200/articles/article" -d '{"title" : "Three", "tags" : ["foo", "bar", "baz"]}'
Now, let’s query the index for articles beginning with letter T and retrieve a terms facet for the tags field. We will name the facet simply: tags.

curl -X POST "http://localhost:9200/articles/_search?pretty=true" -d '
  {
    "query" : { "query_string" : {"query" : "T*"} },
    "facets" : {
      "tags" : { "terms" : {"field" : "tags"} }
    }
  }
'
This request will return articles Two and Three (because they match our query), as well as the tags facet:

"facets" : {
  "tags" : {
    "_type" : "terms",
    "missing" : 0,
    "total": 5,
    "other": 0,
    "terms" : [ {
      "term" : "foo",
      "count" : 2
    }, {
      "term" : "bar",
      "count" : 2
    }, {
      "term" : "baz",
      "count" : 1
    } ]
  }
}
In the terms array, relevant terms and counts are returned. You’ll probably want to display these to your users. The facet returns several important counts:

missing : The number of documents which have no value for the faceted field
total : The total number of terms in the facet
other : The number of terms not included in the returned facet (effectively other = total - terms )
Notice, that the counts are scoped to the current query: foo is counted only twice (not three times), bar is counted twice and baz once. Also note that terms are counted once per document, even if the occur more frequently in that document.

That’s because the primary purpose of facets is to enable faceted navigation, allowing the user to refine her query based on the insight from the facet, i.e. restrict the search to a specific category, price or date range. Facets can be used, however, for other purposes: computing histograms, statistical aggregations, and more. See the blog about data visualization for inspiration.

Scope
As we have already mentioned, facet computation is restricted to the scope of the current query, called main, by default. Facets can be computed within the global scope as well, in which case it will return values computed across all documents in the index:

{
    "facets" : {
        "my_facets" : {
            "terms" : { ... },
            "global" : true 
        }
    }
}

The global keyword can be used with any facet type.

There’s one important distinction to keep in mind. While search queries restrict both the returned documents and facet counts, search filters restrict only returned documents — but not facet counts.

If you need to restrict both the documents and facets, and you’re not willing or able to use a query, you may use a facet filter.

Facet Filter
All facets can be configured with an additional filter (explained in the Query DSL section), which will reduce the documents they use for computing results. An example with a term filter:

{
    "facets" : {
        "<FACET NAME>" : {
            "<FACET TYPE>" : {
                ...
            },
            "facet_filter" : {
                "term" : { "user" : "kimchy"}
            }
        }
    }
}
Note that this is different from a facet of the filter type.

Facets with the nested types
Nested mapping allows for better support for "inner" documents faceting, especially when it comes to multi valued key and value facets (like histograms, or term stats).

What is it good for? First of all, this is the only way to use facets on nested documents once they are used (possibly for other reasons). But, there is also facet specific reason why nested documents can be used, and that’s the fact that facets working on different key and value field (like term_stats, or histogram) can now support cases where both are multi valued properly.

For example, let’s use the following mapping:

{
    "type1" : {
        "properties" : {
            "obj1" : {
                "type" : "nested"
            }
        }
    }
}
And, here is a sample data:

{
    "obj1" : [
        {
            "name" : "blue",
            "count" : 4
        },
        {
            "name" : "green",
            "count" : 6
        }
    ]
}
All Nested Matching Root Documents
Another option is to run the facet on all the nested documents matching the root objects that the main query will end up producing. For example:

{
    "query": {
        "match_all": {}
    },
    "facets": {
        "facet1": {
            "terms_stats": {
                "key_field" : "name",
                "value_field": "count"
            },
            "nested": "obj1"
        }
    }
}
The nested element provides the path to the nested document (can be a multi level nested docs) that will be used.

Facet filter allows you to filter your facet on the nested object level. It is important that these filters match on the nested object level and not on the root document level. In the following example the terms_stats only applies on nested objects with the name blue.

{
    "query": {
        "match_all": {}
    },
    "facets": {
        "facet1": {
            "terms_stats": {
                "key_field" : "name",
                "value_field": "count"
            },
            "nested": "obj1",
            "facet_filter" : {
                "term" : {"name" : "blue"}
            }
        }
    }
}
